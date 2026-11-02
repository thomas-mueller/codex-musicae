package app.web.codexmusicae;

import android.app.Activity;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Presentation mode on Android (PLT-005, PLT-006): sticky immersive mode that draws under display cutouts, and the keep-screen-on flag.
 * All window changes run on the UI thread.
 */
@CapacitorPlugin(name = "Immersive")
public class ImmersivePlugin extends Plugin {
    /** True between enter() and exit(); the activity re-applies the immersive state when the window regains focus. */
    private static boolean active = false;
    private static int previousCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;

    @PluginMethod
    public void enter(final PluginCall call) {
        final Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            if (!active) {
                previousCutoutMode = window.getAttributes().layoutInDisplayCutoutMode;
            }
            active = true;
            applyImmersive(window);
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @PluginMethod
    public void exit(final PluginCall call) {
        final Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            active = false;
            new WindowInsetsControllerCompat(window, window.getDecorView()).show(WindowInsetsCompat.Type.systemBars());
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = previousCutoutMode;
            window.setAttributes(attributes);
            WindowCompat.setDecorFitsSystemWindows(window, true);
            call.resolve();
        });
    }

    /** The keep-screen-on flag alone, for the WakeLock port. */
    @PluginMethod
    public void setKeepAwake(final PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        final Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            if (on) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }

    /** Called from MainActivity.onWindowFocusChanged: the system may restore the bars after a dialog. */
    static void onWindowFocusChanged(Activity activity, boolean hasFocus) {
        if (hasFocus && active) {
            applyImmersive(activity.getWindow());
        }
    }

    private static void applyImmersive(Window window) {
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        WindowManager.LayoutParams attributes = window.getAttributes();
        attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        window.setAttributes(attributes);
    }
}
