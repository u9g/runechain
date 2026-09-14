import SwiftUI
import WebKit

/// Hosts the bundled web game. The web layer is authoritative for everything
/// visual; this wrapper only removes browser chrome and forwards haptics.
struct GameWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.suppressesIncrementalRendering = true
        config.userContentController.add(context.coordinator, name: "haptic")

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsLinkPreview = false
        web.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { web.isInspectable = true }

        guard let root = Bundle.main.url(forResource: "web", withExtension: nil) else {
            assertionFailure("web/ is missing from the bundle")
            return web
        }
        web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        private let light = UIImpactFeedbackGenerator(style: .light)
        private let heavy = UIImpactFeedbackGenerator(style: .medium)

        override init() {
            super.init()
            light.prepare()
            heavy.prepare()
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "haptic", let ms = message.body as? NSNumber else { return }
            // The web side sends a duration; map it onto the two feedback weights.
            if ms.intValue >= 18 { heavy.impactOccurred() } else { light.impactOccurred() }
        }
    }
}
