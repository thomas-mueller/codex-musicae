// UNVERIFIED(ios): written without a Mac or Xcode; only the ios-compile CI job builds it (docs/ios-unverified.md).
import Capacitor
import UIKit

/// The web view controller of the app: registers the app's own plugins and hides the status bar and the home indicator while
/// presentation mode is active (PLT-013, the iOS counterpart of the Android ImmersivePlugin).
class BridgeViewController: CAPBridgeViewController {
    /// True between `enter` and `exit` of the Immersive plugin; only touched on the main thread.
    static var presenting = false

    override var prefersStatusBarHidden: Bool {
        return super.prefersStatusBarHidden || BridgeViewController.presenting
    }

    override var prefersHomeIndicatorAutoHidden: Bool {
        return BridgeViewController.presenting
    }

    override func capacitorDidLoad() {
        let documentAccess = DocumentAccessPlugin()
        DocumentAccessPlugin.instance = documentAccess
        bridge?.registerPluginInstance(documentAccess)
        bridge?.registerPluginInstance(ImmersivePlugin())
    }

    func refreshPresentation() {
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }
}
