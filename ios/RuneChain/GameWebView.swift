import SwiftUI
import WebKit

/// Hosts the bundled web game. The web layer is authoritative for everything
/// visual; this wrapper only removes browser chrome, forwards haptics, and
/// hands the web side the safe-area insets.
struct GameWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> InsetReportingWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.suppressesIncrementalRendering = true
        config.userContentController.add(context.coordinator, name: "haptic")

        let web = InsetReportingWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        context.coordinator.web = web
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

    func updateUIView(_ uiView: InsetReportingWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        weak var web: InsetReportingWebView?
        private let light = UIImpactFeedbackGenerator(style: .light)
        private let heavy = UIImpactFeedbackGenerator(style: .medium)

        override init() {
            super.init()
            light.prepare()
            heavy.prepare()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            (webView as? InsetReportingWebView)?.reportSafeAreaInsets()
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "haptic", let ms = message.body as? NSNumber else { return }
            // The web side sends a duration; map it onto the two feedback weights.
            if ms.intValue >= 18 { heavy.impactOccurred() } else { light.impactOccurred() }
        }
    }
}

/// SwiftUI's `ignoresSafeArea` zeroes this view's own insets, which also zeroes
/// `env(safe-area-inset-*)` inside the page. Push the window's insets instead,
/// or the board draws under the Dynamic Island.
final class InsetReportingWebView: WKWebView {
    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        reportSafeAreaInsets()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        reportSafeAreaInsets()
    }

    func reportSafeAreaInsets() {
        let insets = window?.safeAreaInsets ?? safeAreaInsets
        let js = "window.setSafeInsets && window.setSafeInsets(\(insets.top), \(insets.bottom))"
        evaluateJavaScript(js, completionHandler: nil)
    }
}
