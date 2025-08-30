import { scriptio, scriptHelper, onVueComponentMount, onVueComponentUnmount } from "./modules/renderer/javascript.js";

Object.defineProperty(window, "scriptio", {
    value: scriptio,
    writable: false,
    enumerable: true,
    configurable: false
});
Object.defineProperty(window, "scriptio_toolkit", { // Kept for compatibility - will be deprecated.
    value: scriptio,
    writable: false,
    enumerable: true,
    configurable: false
});

scriptio_internal.onUpdateScript((event, args) => {
    scriptHelper(args.path, args.code, args.enabled, args.meta.description, args.meta["run-at"]);
});
scriptio_internal.rendererReady();

/**
 * Called when the settings window is created.
 * @param {Element} view The settings view element.
 */
async function onSettingWindowCreated(view) {
    const { initScriptioSettings, scriptioSettingsUpdateScript } = await import("./modules/renderer/settings.js");
    const container = await initScriptioSettings(view);
    scriptio_internal.onUpdateScript((event, args) => {
        scriptioSettingsUpdateScript(container, args);
    });
    scriptio_internal.rendererReady(); //  // Call again to ensure the settings view gets the scripts data.
}

// https://github.com/QwQ-002/QwQNT-RendererEvents
window.RendererEvents?.onSettingsWindowCreated?.(async () => {
    // https://github.com/QwQ-002/QwQNT-PluginSettings
    const view = await window.PluginSettings?.renderer?.registerPluginSettings?.(qwqnt.framework.plugins.scriptio.meta.packageJson);
    if (view) {
        onSettingWindowCreated(view);
    }
});

export { onSettingWindowCreated, onVueComponentMount, onVueComponentUnmount };
