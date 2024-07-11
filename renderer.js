const scriptDataAttr = "data-scriptio-script";
const configDataAttr = "data-scriptio-config";
const switchDataAttr = "data-scriptio-switch";
const eventName = "scriptio-toggle";
const toolkitEventName = "scriptio-toolkit";
const $ = document.querySelector.bind(document);
const pluginPath = LiteLoader.plugins.scriptio.path.plugin.replace(":\\", "://").replaceAll("\\", "/"); // Normalized plugin path
const dataPath = LiteLoader.plugins.scriptio.path.data.replace(":\\", "://").replaceAll("\\", "/");
let isDebug = false;
let log = () => { }; // Dummy function

const listeners = new Map();
const scriptio_toolkit = {
    listen: (toggleFunc, immediate) => {
        const self = scriptio_toolkit.scriptPath;
        listeners.set(self, toggleFunc);
        if (immediate) {
            toggleFunc(true);
        }
    },
    register: (tool, value) => { // Register a tool
        if (tool in scriptio_toolkit) {
            return false;
        }
        scriptio_toolkit[tool] = value;
        window.dispatchEvent(new CustomEvent(toolkitEventName, { detail: tool }));
        return true;
    },
    wait: (tool, timeout = 5000) => { // Wait for a tool to be registered
        return new Promise((resolve, reject) => {
            if (tool in scriptio_toolkit) {
                return resolve(scriptio_toolkit[tool]);
            }
            const timer = setTimeout(() => {
                window.removeEventListener(toolkitEventName, listener);
                if (tool in scriptio_toolkit) {
                    resolve(scriptio_toolkit[tool]);
                } else {
                    reject(new Error("Timeout waiting for:", tool));
                }
            }, timeout);
            function listener(event) {
                if (event.detail === tool) {
                    clearTimeout(timer);
                    log("Toolkit event received:", tool);
                    resolve(scriptio_toolkit[tool]);
                }
            }
            window.addEventListener(toolkitEventName, listener, { once: true });
        });
    },
    fetchText: scriptio.fetchText
};
Object.defineProperty(window, "scriptio_toolkit", {
    value: scriptio_toolkit,
    writable: false,
    enumerable: true,
    configurable: false
});
Object.defineProperties(scriptio_toolkit, {
    page: {
        get: () => window.location.hash.slice(2).split("/")[0],
        set: () => { }
    },
    scriptPath: {
        get: () => document.currentScript?.getAttribute("data-scriptio-script"),
        set: () => { }
    }
});

// Get page
const pagePromise = new Promise((resolve, reject) => {
    let page = scriptio_toolkit.page;
    if (page && page !== "blank") {
        log("Page is:", page);
        resolve(page);
    } else {
        log("Waiting for navigation...");
        navigation.addEventListener("navigatesuccess", () => {
            page = scriptio_toolkit.page;
            log("Page is:", page);
            resolve(page);
        }, { once: true });
    }
});
// Helper function for js
function injectJS(path, code, enabled) {
    let current = $(`script[${scriptDataAttr}="${path}"]`);
    if (!current && enabled) {
        current = document.createElement("script");
        current.setAttribute(scriptDataAttr, path);
        current.textContent = code;
        document.body.appendChild(current);
    }
    window.dispatchEvent(new CustomEvent(eventName, {
        detail: {
            path: path,
            enabled: enabled
        }
    }));
    const toggleFunc = listeners.get(path);
    if (toggleFunc) {
        toggleFunc(enabled);
    }
    return true;
}
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
function scriptHelper(path, code, enabled, description, runAts) {
    pagePromise.then(page => {
        const result = test(path, code, enabled, page, runAts);
        log(`"${path}" injected? ${result}`);
    });
}
scriptio.onUpdateScript((event, args) => {
    scriptHelper(args.path, args.code, args.enabled, args.meta.description, args.meta["run-at"]);
});
scriptio.rendererReady();
scriptio.queryIsDebug().then(enabled => {
    isDebug = enabled;
    if (isDebug) {
        log = console.log.bind(console, "[Scriptio]");
        log("Debug mode activated");
    }
});
async function onSettingWindowCreated(view) {
    const r = await fetch(`local:///${pluginPath}/settings.html`);
    const $ = view.querySelector.bind(view);
    view.innerHTML = await r.text();
    const container = $("setting-section.snippets > setting-panel > setting-list");
    function addItem(path) { // Add a list item with name and description, returns the switch
        const item = container.appendChild(document.createElement("setting-item"));
        item.setAttribute("data-direction", "row");
        item.setAttribute(configDataAttr, path);
        // Left side - Name and description
        const left = item.appendChild(document.createElement("div"));
        const itemName = left.appendChild(document.createElement("setting-text"));
        const itemDesc = left.appendChild(document.createElement("setting-text"));
        itemDesc.setAttribute("data-type", "secondary");
        const right = item.appendChild(document.createElement("div"));
        right.classList.add("scriptio-menu");
        // Right side - More options
        function addScriptioMore(icon, title, className) {
            const more = right.appendChild(document.createElement("span"));
            more.textContent = icon;
            more.classList.add("scriptio-more", className);
            more.title = title;
            return more;
        }
        const homepage = addScriptioMore("🔗", "打开脚本主页", "scriptio-homepage");
        homepage.addEventListener("click", () => {
            if (!item.hasAttribute("data-deleted") && !homepage.hasAttribute("disabled")) {
                scriptio.open("link", homepage.getAttribute("data-homepage-url"));
            }
        });
        const remove = addScriptioMore("🗑️", "删除此脚本", "scriptio-remove");
        remove.addEventListener("click", () => {
            if (!item.hasAttribute("data-deleted")) {
                scriptio.removeScript(path);
            }
        });
        const showInFolder = addScriptioMore("📂", "在文件夹中显示", "scriptio-folder");
        showInFolder.addEventListener("click", () => {
            if (!item.hasAttribute("data-deleted")) {
                scriptio.open("show", path);
            }
        });
        const switch_ = right.appendChild(document.createElement("setting-switch"));
        switch_.setAttribute(switchDataAttr, path);
        switch_.title = "启用/禁用此脚本";
        switch_.addEventListener("click", () => {
            if (!item.hasAttribute("data-deleted")) {
                switch_.parentNode.classList.toggle("is-loading", true);
                scriptio.configChange(path, switch_.toggleAttribute("is-active")); // Update the UI immediately, so it would be more smooth
            }
        });
        return item;
    }
    scriptio.onUpdateScript((event, args) => {
        const { path, meta, enabled } = args;
        const isDeleted = meta.name === " [已删除] ";
        const item = $(`setting-item[${configDataAttr}="${path}"]`) || addItem(path);
        const itemName = item.querySelector("setting-text");
        const optionalVersion = meta.version ? ` (v${meta.version})` : "";
        itemName.textContent = meta.name + optionalVersion;
        itemName.title = path;
        const itemDesc = item.querySelector("setting-text[data-type='secondary']");
        itemDesc.textContent = meta.description || "此文件没有描述";
        itemDesc.title = itemDesc.textContent;
        if (!meta.reactive) {
            itemDesc.textContent = "* " + itemDesc.textContent;
            itemDesc.title += "\n对此脚本的更改将在重载后生效";
        }
        const homepage = item.querySelector("span.scriptio-homepage");
        const url = meta.homepageURL;
        if (url && (url.startsWith("https://") || url.startsWith("http://"))) {
            homepage.setAttribute("data-homepage-url", url);
            homepage.toggleAttribute("disabled", false);
        } else {
            homepage.removeAttribute("data-homepage-url");
            homepage.toggleAttribute("disabled", true);
        }
        const switch_ = item.querySelector(`setting-switch[${switchDataAttr}="${path}"]`);
        switch_.toggleAttribute("is-active", enabled);
        switch_.parentNode.classList.toggle("is-loading", false);
        if (isDeleted) {
            item.toggleAttribute("data-deleted", true);
        }
        log("onUpdateScript", path, enabled);
    });
    function devMode() {
        const enabled = this.toggleAttribute("is-active");
        scriptio.devMode(enabled);
    }
    function openURI(type, uri) {
        console.log("[Scriptio] Opening", type, uri);
        scriptio.open(type, uri);
    }
    function openURL() {
        const url = this.getAttribute("data-scriptio-url");
        openURI("link", url);
    }
    async function importScript() {
        if (this.files.length == 0) return; // No file selected
        this.parentNode.classList.toggle("is-loading", true);
        let cnt = 0;
        const promises = [];
        for (let file of this.files) {
            if (!file.name.endsWith(".js")) {
                console.log("[Scriptio] Ignored", file.name);
                continue;
            }
            promises.push(new Promise((resolve, reject) => {
                cnt++;
                console.log("[Scriptio] Importing", file.name);
                let reader = new FileReader();
                reader.onload = () => {
                    scriptio.importScript(file.name, reader.result);
                    console.log("[Scriptio] Imported", file.name);
                    resolve();
                };
                reader.readAsText(file);
            }));
        }
        await Promise.all(promises);
        this.parentNode.classList.toggle("is-loading", false);
        console.log("[Scriptio] Imported", cnt, "files");
        if (cnt > 0) {
            alert(`成功导入 ${cnt} 个 JS 文件`);
        } else {
            alert("没有导入任何 JS 文件");
        }
    }
    scriptio.rendererReady(); // We don't have to create a new function for this 😉
    const dev = $("#scriptio-dev");
    dev.addEventListener("click", devMode);
    scriptio.queryDevMode().then(enabled => {
        log("queryDevMode", enabled);
        dev.toggleAttribute("is-active", enabled);
    });
    if (isDebug) {
        const debug = $("#scriptio-debug");
        debug.style.color = "red";
        debug.title = "Debug 模式已激活";
    }
    $("#scriptio-reload").addEventListener("dblclick", scriptio.reload);
    $("#scriptio-open-folder").addEventListener("click", () => {
        openURI("path", `${dataPath}/scripts`); // Relative to the data directory
    });
    $("#scriptio-import").addEventListener("change", importScript);
    // About - Version
    $("#scriptio-version").textContent = LiteLoader.plugins.scriptio.manifest.version;
    // About - Backgroud image
    ["version", "author", "issues", "submit"].forEach(id => {
        $(`#scriptio-about-${id}`).style.backgroundImage = `url("local:///${pluginPath}/icons/${id}.svg")`;
    });
    // Logo
    const logo = $(".logo");
    logo.src = `local:///${pluginPath}/icons/icon.svg`;
    // Easter egg
    function shakeWindow() {
        // Use moveBy to shake the window
        const magnitude = 10;
        const c = Math.PI / 4;
        let t = 0;
        const timer = setInterval(() => {
            const delta = magnitude * (Math.sin(c * (t + 1)) - Math.sin(c * t));
            window.moveBy(delta, 0);
            t++;
            if (t >= 16) {
                clearInterval(timer);
            }
        }, 100);
    }
    const max = 10;
    logo.addEventListener("animationend", () => {
        const cnt = parseInt(logo.style.getPropertyValue("--data-cnt"));
        if (cnt >= max) {
            shakeWindow();
        } else {
            logo.style.setProperty("--data-cnt", cnt + 1);
        }
    });
    view.querySelectorAll(".scriptio-link").forEach(link => {
        if (!link.getAttribute("title")) {
            link.setAttribute("title", link.getAttribute("data-scriptio-url"));
        }
        link.addEventListener("click", openURL);
    });
}

export {
    onSettingWindowCreated
}