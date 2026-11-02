package app.web.codexmusicae;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersivePlugin.class);
        registerPlugin(DocumentAccessPlugin.class);
        super.onCreate(savedInstanceState);
        DocumentAccessPlugin.handleViewIntent(this, getIntent());
    }

    /** "Open with" while the app is running (launchMode singleTask). FIL-018 */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        DocumentAccessPlugin.handleViewIntent(this, intent);
    }

    /** TEMPORARY diagnostic: logs the full stack of an exception thrown while an activity result is delivered. */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Log.i("CM-DIAG", "onActivityResult enter: request=" + requestCode + " result=" + resultCode + " data=" + data);
        try {
            super.onActivityResult(requestCode, resultCode, data);
        } catch (RuntimeException e) {
            Log.e("CM-DIAG", "onActivityResult failed: request=" + requestCode + " result=" + resultCode, e);
            throw e;
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        ImmersivePlugin.onWindowFocusChanged(this, hasFocus);
    }
}
