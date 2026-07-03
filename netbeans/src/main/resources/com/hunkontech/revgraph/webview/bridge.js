// Injected by the Apache NetBeans host BEFORE the shared renderer bundle so
// packages/graph-webview/src/host-bridge.ts detects the embedded-IDE transport
// (window.__ideHostPostMessage__) at load time rather than falling through to
// the browser-harness path.
//
// The real Java callback object is attached separately, as
// window.__revGraphBridge__, by NetBeansWebViewHost.kt once the page has
// finished loading (JavaFX WebView JSObject.setMember). This indirection lets
// the message function exist up-front and resolve the callback lazily at call
// time; messages sent in the brief window before the callback is attached are
// dropped, which is harmless (the host re-pushes the graph on load).
(function () {
  window.__ideHostPostMessage__ = function (msg) {
    var b = window.__revGraphBridge__;
    if (b) b.post(msg);
  };
})();
