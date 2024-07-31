import { scriptio, scriptHelper, onVueComponentMount, onVueComponentUnmount } from "./modules/renderer/javascript.js";
import { initScriptioSettings, scriptioSettingsUpdateScript } from "./modules/renderer/settings.js"

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
    const container = await initScriptioSettings(view);
    scriptio_internal.onUpdateScript((event, args) => {
        scriptioSettingsUpdateScript(container, args);
    });
    scriptio_internal.rendererReady(); //  // Call again to ensure the settings view gets the scripts data.
}

export { onSettingWindowCreated, onVueComponentMount, onVueComponentUnmount };
