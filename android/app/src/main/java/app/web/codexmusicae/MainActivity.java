package app.web.codexmusicae;

import android.content.Intent;
import android.os.Bundle;

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

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        ImmersivePlugin.onWindowFocusChanged(this, hasFocus);
    }
}
