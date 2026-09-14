import SwiftUI

@main
struct RuneChainApp: App {
    var body: some Scene {
        WindowGroup {
            GameWebView()
                .ignoresSafeArea()          // the web layout owns the safe area, via env()
                .background(Color(red: 0.043, green: 0.051, blue: 0.094))
                .persistentSystemOverlays(.hidden)
                .statusBarHidden()
        }
    }
}
