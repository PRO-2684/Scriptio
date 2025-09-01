// Utilities related to javascript & `scriptio` object.
import { log } from "./debug.js";

/** Event that is dispatched when a tool is registered. */
const toolRegisteredEvent = "scriptio-tool-register";
/** Listeners for tools. */
const listeners = new Map();
/** The `scriptio` object. */
const scriptio = {
    listen: (toggleFunc, options) => {
        // `options` can be an object or a boolean (for compatibility).
        if (typeof options === "boolean") {
            options = { immediate: options };
        }
        const self = options?.scriptPath ?? scriptio.scriptPath;
        listeners.set(self, toggleFunc);
        if (options?.immediate) {
            toggleFunc(true);
        }
    },
    register: (tool, value) => { // Register a tool
        if (tool in scriptio) {
            return false;
        }
        scriptio[tool] = value;
        window.dispatchEvent(new CustomEvent(toolRegisteredEvent, { detail: tool }));
        return true;
    },
    wait: (tool, timeout = 5000) => { // Wait for a tool to be registered
        return new Promise((resolve, reject) => {
            if (tool in scriptio) {
                return resolve(scriptio[tool]);
            }
            const timer = setTimeout(() => {
                window.removeEventListener(toolRegisteredEvent, listener);
                if (tool in scriptio) {
                    resolve(scriptio[tool]);
                } else {
                    reject(new Error("Timeout waiting for:", tool));
                }
            }, timeout);
            function listener(event) {
                if (event.detail === tool) {
                    clearTimeout(timer);
                    log("Toolkit event received:", tool);
                    resolve(scriptio[tool]);
                }
            }
            window.addEventListener(toolRegisteredEvent, listener, { once: true });
        });
    },
    open: scriptio_internal.open,
    fetchText: scriptio_internal.fetchText,
    vueMount: [],
    vueUnmount: [],
    invokeNative: scriptio_internal.invokeNative,
    ipcRenderer: scriptio_internal.ipcRenderer,
};
Object.defineProperties(scriptio, {
    page: {
        get: () => window.location.hash.slice(2).split("/")[0],
        set: () => { }
    },
    scriptPath: {
        get: () => document.currentScript?.getAttribute("data-scriptio-script"),
        set: () => { }
    }
});
/** Attribute name for the script element to store the path of the javascript file. */
const scriptDataAttr = "data-scriptio-script";
/** Promise that resolves to the current page. */
const pagePromise = new Promise((resolve, reject) => {
    let page = scriptio.page;
    if (page && page !== "blank") {
        log("Page is:", page);
        resolve(page);
    } else {
        log("Waiting for navigation...");
        navigation.addEventListener("navigatesuccess", () => {
            page = scriptio.page;
            log("Page is:", page);
            resolve(page);
        }, { once: true });
    }
});

/**
 * Injects javascript into the page.
 * @param {string} path Path of the script.
 * @param {string} code Code of the script.
 * @param {boolean} enabled Whether the script is enabled.
 * @returns {boolean} Whether the script was injected (always true).
 */
function injectJS(path, code, enabled) {
    let current = document.querySelector(`script[${scriptDataAttr}="${path}"]`);
    if (!current && enabled) {
        current = document.createElement("script");
        current.setAttribute(scriptDataAttr, path);
        current.textContent = code;
        document.body.appendChild(current);
    }
    const toggleFunc = listeners.get(path);
    if (toggleFunc) {
        toggleFunc(enabled);
    }
    return true;
}
/**
 * Tests whether a script should be injected, and injects it if necessary.
 * @param {string} path Path of the script.
 * @param {string} code Code of the script.
 * @param {boolean} enabled Whether the script is enabled.
 * @param {string} page Current page.
 * @param {string[]} runAts Pages to run the script at.
 * @returns {boolean} Whether the script was injected.
 */
function test(path, code, enabled, page, runAts) {
    log(`path: ${path}, page: ${page}, runAts: ${runAts}`);
    if (!runAts.length || runAts.includes(page)) {
        injectJS(path, code, enabled);
        return true;
    } else if (page !== "blank") {
        if (runAts.includes(page)) {
            injectJS(path, code, enabled);
            return true;
        }
    }
    return false;
}
/**
 * Helper function that injects a script into the page if it should be injected.
 * @param {string} path Path of the script.
 * @param {string} code Code of the script.
 * @param {boolean} enabled Whether the script is enabled.
 * @param {string} description Description of the script.
 * @param {string[]} runAts Pages to run the script at.
 */
function scriptHelper(path, code, enabled, description, runAts) {
    pagePromise.then(page => {
        const result = test(path, code, enabled, page, runAts);
        log(`"${path}" injected? ${result}`);
    });
}
/**
 * Called when a Vue component is mounted.
 * @param {ComponentInternalInstance} component The Vue component instance.
 */
function onVueComponentMount(component) {
    for (let i = 0; i < scriptio.vueMount.length; i++) {
        try {
            scriptio.vueMount[i](component);
        } catch (error) {
            log(`Error calling scriptio.vueMount[${i}]:`, error);
        }
    }
}
/**
 * Called when a Vue component is unmounted.
 * @param {ComponentInternalInstance} component The Vue component instance.
 */
function onVueComponentUnmount(component) {
    for (let i = 0; i < scriptio.vueUnmount.length; i++) {
        try {
            scriptio.vueUnmount[i](component);
        } catch (error) {
            log(`Error calling scriptio.vueUnmount[${i}]:`, error);
        }
    }
}

export { scriptio, scriptHelper, onVueComponentMount, onVueComponentUnmount };
