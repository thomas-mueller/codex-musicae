package app.web.codexmusicae;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Storage Access Framework access for PDFs (PLT-008, FIL-018): picks documents with persistable read-write permission, reads and
 * writes them in chunks, creates documents for "save a copy" and queues files handed to the app by a VIEW intent.
 * Only file references (id -> URI) are stored, in this plugin's own SharedPreferences; never PDF bytes.
 * Errors reach the web side as rejections whose code is one of the FileAccessError values.
 */
@CapacitorPlugin(name = "DocumentAccess")
public class DocumentAccessPlugin extends Plugin {
    private static final String PREFS = "cm-document-access";
    private static final String PDF_MIME = "application/pdf";
    private static final int COPY_BUFFER_BYTES = 64 * 1024;

    private static final List<JSObject> pendingIncoming = new ArrayList<>();
    private static DocumentAccessPlugin instance;

    private final Map<String, FileChannel> readers = new ConcurrentHashMap<>();
    private final Map<String, ParcelFileDescriptor> readerDescriptors = new ConcurrentHashMap<>();
    private final Map<String, WriteSession> writers = new ConcurrentHashMap<>();

    private static final class WriteSession {
        final Uri target;
        final File temp;
        final FileOutputStream out;

        WriteSession(Uri target, File temp, FileOutputStream out) {
            this.target = target;
            this.temp = temp;
            this.out = out;
        }
    }

    @Override
    public void load() {
        instance = this;
    }

    // --- picking -------------------------------------------------------------------------------------------------

    @PluginMethod
    public void pickDocuments(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(PDF_MIME);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, Boolean.TRUE.equals(call.getBoolean("multiple", true)));
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSArray files = new JSArray();
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK && data != null) {
            List<Uri> uris = new ArrayList<>();
            if (data.getClipData() != null) {
                for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                    uris.add(data.getClipData().getItemAt(i).getUri());
                }
            } else if (data.getData() != null) {
                uris.add(data.getData());
            }
            for (Uri uri : uris) {
                files.put(describe(getContext(), remember(getContext(), uri), uri, persist(getContext(), uri)));
            }
        }
        JSObject response = new JSObject();
        response.put("files", files);
        call.resolve(response);
    }

    // --- reading -------------------------------------------------------------------------------------------------

    @PluginMethod
    public void openRead(PluginCall call) {
        String id = call.getString("id");
        Uri uri = uriOf(getContext(), id);
        if (uri == null) {
            call.reject("unknown id", "not-found");
            return;
        }
        try {
            ParcelFileDescriptor descriptor = getContext().getContentResolver().openFileDescriptor(uri, "r");
            if (descriptor == null) {
                call.reject("cannot open", "not-found");
                return;
            }
            String handle = UUID.randomUUID().toString();
            readerDescriptors.put(handle, descriptor);
            FileChannel channel = new FileInputStream(descriptor.getFileDescriptor()).getChannel();
            readers.put(handle, channel);
            JSObject response = new JSObject();
            response.put("handle", handle);
            response.put("size", descriptor.getStatSize());
            response.put("writable", hasPersistedWrite(getContext(), uri));
            call.resolve(response);
        } catch (SecurityException e) {
            call.reject("permission lost", "denied");
        } catch (java.io.FileNotFoundException e) {
            call.reject("file not found", "not-found");
        } catch (Exception e) {
            call.reject("read failed", "read-failed");
        }
    }

    @PluginMethod
    public void readChunk(PluginCall call) {
        FileChannel channel = readers.get(call.getString("handle"));
        // PluginCall.getLong returns null for a JSON number that parsed as Integer (every offset below 2 GiB).
        Object rawOffset = call.getData().opt("offset");
        Long offset = rawOffset instanceof Number ? ((Number) rawOffset).longValue() : null;
        Integer length = call.getInt("length");
        if (channel == null || offset == null || length == null) {
            call.reject("bad handle", "read-failed");
            return;
        }
        try {
            ByteBuffer buffer = ByteBuffer.allocate(length);
            channel.position(offset);
            int total = 0;
            while (total < length) {
                int read = channel.read(buffer);
                if (read < 0) {
                    break;
                }
                total += read;
            }
            JSObject response = new JSObject();
            response.put("data", Base64.encodeToString(buffer.array(), 0, total, Base64.NO_WRAP));
            call.resolve(response);
        } catch (IOException e) {
            call.reject("read failed", "read-failed");
        }
    }

    @PluginMethod
    public void closeRead(PluginCall call) {
        String handle = call.getString("handle");
        closeQuietly(readers.remove(handle));
        closeQuietly(readerDescriptors.remove(handle));
        call.resolve();
    }

    // --- writing -------------------------------------------------------------------------------------------------

    @PluginMethod
    public void openWrite(PluginCall call) {
        Uri uri = uriOf(getContext(), call.getString("id"));
        if (uri == null) {
            call.reject("unknown id", "not-found");
            return;
        }
        try {
            File temp = File.createTempFile("write-", ".tmp", getContext().getCacheDir());
            String handle = UUID.randomUUID().toString();
            writers.put(handle, new WriteSession(uri, temp, new FileOutputStream(temp)));
            JSObject response = new JSObject();
            response.put("handle", handle);
            call.resolve(response);
        } catch (IOException e) {
            call.reject("cannot create temp file", "write-failed");
        }
    }

    @PluginMethod
    public void writeChunk(PluginCall call) {
        WriteSession session = writers.get(call.getString("handle"));
        String data = call.getString("data");
        if (session == null || data == null) {
            call.reject("bad handle", "write-failed");
            return;
        }
        try {
            session.out.write(Base64.decode(data, Base64.NO_WRAP));
            call.resolve();
        } catch (IOException | IllegalArgumentException e) {
            call.reject("write failed", "write-failed");
        }
    }

    /**
     * The truncating write ("wt") runs here in one native loop, as short as possible (LIM-011): the target is only touched once the
     * complete new content is in the temp file.
     */
    @PluginMethod
    public void commitWrite(PluginCall call) {
        WriteSession session = writers.remove(call.getString("handle"));
        if (session == null) {
            call.reject("bad handle", "write-failed");
            return;
        }
        try {
            session.out.close();
            ContentResolver resolver = getContext().getContentResolver();
            try (InputStream in = new FileInputStream(session.temp); OutputStream out = resolver.openOutputStream(session.target, "wt")) {
                if (out == null) {
                    call.reject("cannot open target", "write-failed");
                    return;
                }
                byte[] buffer = new byte[COPY_BUFFER_BYTES];
                int read;
                while ((read = in.read(buffer)) > 0) {
                    out.write(buffer, 0, read);
                }
                out.flush();
            }
            call.resolve();
        } catch (SecurityException e) {
            call.reject("permission lost", "denied");
        } catch (IOException e) {
            call.reject("write failed", "write-failed");
        } finally {
            session.temp.delete();
        }
    }

    @PluginMethod
    public void abortWrite(PluginCall call) {
        WriteSession session = writers.remove(call.getString("handle"));
        if (session != null) {
            closeQuietly(session.out);
            session.temp.delete();
        }
        call.resolve();
    }

    // --- save a copy ---------------------------------------------------------------------------------------------

    @PluginMethod
    public void createDocument(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(PDF_MIME);
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "document.pdf"));
        startActivityForResult(call, intent, "onCreated");
    }

    @ActivityCallback
    private void onCreated(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSObject response = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK && data != null && data.getData() != null) {
            Uri uri = data.getData();
            response.put("id", remember(getContext(), uri));
        }
        call.resolve(response);
    }

    // --- references ----------------------------------------------------------------------------------------------

    @PluginMethod
    public void isPersisted(PluginCall call) {
        Uri uri = uriOf(getContext(), call.getString("id"));
        JSObject response = new JSObject();
        response.put("persisted", uri != null && hasPersistedRead(getContext(), uri));
        call.resolve(response);
    }

    @PluginMethod
    public void forget(PluginCall call) {
        String id = call.getString("id");
        Uri uri = uriOf(getContext(), id);
        if (uri != null) {
            try {
                getContext().getContentResolver().releasePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (SecurityException ignored) {
                // The permission was never persisted.
            }
            prefs(getContext()).edit().remove("uri:" + id).apply();
        }
        call.resolve();
    }

    /** Returns the files queued by VIEW intents and empties the queue. */
    @PluginMethod
    public void getPendingIncoming(PluginCall call) {
        JSArray files = new JSArray();
        synchronized (pendingIncoming) {
            for (JSObject file : pendingIncoming) {
                files.put(file);
            }
            pendingIncoming.clear();
        }
        JSObject response = new JSObject();
        response.put("files", files);
        call.resolve(response);
    }

    // --- "Open with" -----------------------------------------------------------------------------------------------

    /** Called by MainActivity for the launch intent and every new intent (FIL-018). */
    static void handleViewIntent(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) {
            return;
        }
        Uri uri = intent.getData();
        boolean writable = false;
        if ("content".equals(uri.getScheme())) {
            writable = persist(context, uri);
            if (!writable) {
                writable = (intent.getFlags() & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) != 0;
            }
        }
        String id = remember(context, uri);
        JSObject file = describe(context, id, uri, writable);
        synchronized (pendingIncoming) {
            pendingIncoming.add(file);
        }
        // The web side answers this by calling getPendingIncoming(); a file queued before the page listens is picked up at startup.
        if (instance != null) {
            instance.notifyListeners("incomingFile", new JSObject());
        }
        intent.setData(null);
    }

    // --- helpers -------------------------------------------------------------------------------------------------

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String remember(Context context, Uri uri) {
        SharedPreferences preferences = prefs(context);
        for (Map.Entry<String, ?> entry : preferences.getAll().entrySet()) {
            if (entry.getKey().startsWith("uri:") && uri.toString().equals(entry.getValue())) {
                return entry.getKey().substring("uri:".length());
            }
        }
        String id = UUID.randomUUID().toString();
        preferences.edit().putString("uri:" + id, uri.toString()).apply();
        return id;
    }

    private static Uri uriOf(Context context, String id) {
        if (id == null) {
            return null;
        }
        String value = prefs(context).getString("uri:" + id, null);
        return value == null ? null : Uri.parse(value);
    }

    /** Persists read and write; if write is refused persists read only. Returns whether write was persisted. */
    private static boolean persist(Context context, Uri uri) {
        ContentResolver resolver = context.getContentResolver();
        try {
            resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return true;
        } catch (SecurityException | UnsupportedOperationException e) {
            try {
                resolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (SecurityException | UnsupportedOperationException ignored) {
                // Neither could be persisted: the file stays usable until the process ends.
            }
            return false;
        }
    }

    private static boolean hasPersistedRead(Context context, Uri uri) {
        for (android.content.UriPermission permission : context.getContentResolver().getPersistedUriPermissions()) {
            if (permission.getUri().equals(uri) && permission.isReadPermission()) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasPersistedWrite(Context context, Uri uri) {
        for (android.content.UriPermission permission : context.getContentResolver().getPersistedUriPermissions()) {
            if (permission.getUri().equals(uri) && permission.isWritePermission()) {
                return true;
            }
        }
        return false;
    }

    private static JSObject describe(Context context, String id, Uri uri, boolean writable) {
        JSObject file = new JSObject();
        file.put("id", id);
        file.put("name", uri.getLastPathSegment() == null ? "document.pdf" : uri.getLastPathSegment());
        file.put("writable", writable);
        try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int name = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int size = cursor.getColumnIndex(OpenableColumns.SIZE);
                int modified = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
                if (name >= 0 && !cursor.isNull(name)) {
                    file.put("name", cursor.getString(name));
                }
                if (size >= 0 && !cursor.isNull(size)) {
                    file.put("size", cursor.getLong(size));
                }
                if (modified >= 0 && !cursor.isNull(modified)) {
                    file.put("lastModified", cursor.getLong(modified));
                }
            }
        } catch (RuntimeException ignored) {
            // Metadata is optional; the name falls back to the last path segment.
        }
        return file;
    }

    private static void closeQuietly(java.io.Closeable closeable) {
        if (closeable != null) {
            try {
                closeable.close();
            } catch (IOException ignored) {
                // Nothing more to release.
            }
        }
    }
}
