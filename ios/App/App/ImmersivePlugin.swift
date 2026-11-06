// UNVERIFIED(ios): written without a Mac or Xcode; only the ios-compile CI job builds it (docs/ios-unverified.md).
import Capacitor
import UIKit

/// Presentation mode on iOS (PLT-013): hides the status bar and the home indicator through `BridgeViewController` and keeps the
/// screen awake. Same JS API as the Android plugin (`enter`, `exit`, `setKeepAwake`).
@objc(ImmersivePlugin)
public class ImmersivePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ImmersivePlugin"
    public let jsName = "Immersive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(#selector(enter(_:)), returnType: .promise),
        CAPPluginMethod(#selector(exit(_:)), returnType: .promise),
        CAPPluginMethod(#selector(setKeepAwake(_:)), returnType: .promise)
    ]

    @objc func enter(_ call: CAPPluginCall) {
        apply(call, presenting: true, keepAwake: true)
    }

    @objc func exit(_ call: CAPPluginCall) {
        apply(call, presenting: false, keepAwake: false)
    }

    /// The idle timer alone, for the WakeLock port.
    @objc func setKeepAwake(_ call: CAPPluginCall) {
        apply(call, presenting: nil, keepAwake: call.getBool("on", false))
    }

    private func apply(_ call: CAPPluginCall, presenting: Bool?, keepAwake: Bool) {
        DispatchQueue.main.async {
            if let presenting = presenting {
                BridgeViewController.presenting = presenting
                (self.bridge?.viewController as? BridgeViewController)?.refreshPresentation()
            }
            UIApplication.shared.isIdleTimerDisabled = keepAwake
            call.resolve()
        }
    }
}
