// Description: Debugging utilities for the renderer.

/** If debug mode is enabled. */
let isDebug = false;
scriptio_internal.queryIsDebug().then((result) => {
    isDebug = result;
});

/**
 * Log to console if debug mode is enabled.
 * @param  {...any} args Arguments to log.
 */
function log(...args) {
    if (isDebug) {
        console.log("[Scriptio]", ...args);
    }
}
/**
 * Show debug hint on settings page.
 * @param {Element} view View element.
 */
function showDebugHint(view) {
    if (isDebug) {
        const debug = view.querySelector("#scriptio-debug");
        debug.style.color = "red";
        debug.title = "Debug 模式已激活";
    }
}

export { log, showDebugHint };
