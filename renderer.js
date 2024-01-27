const scriptDataAttr = "data-scriptio-script";
const configDataAttr = "data-scriptio-config";
const switchDataAttr = "data-scriptio-switch";
const eventName = "scriptio-toggle";
const $ = document.querySelector.bind(document);
// Normalized plugin path
const pluginPath = LiteLoader.plugins.scriptio.path.plugin.replace(":\\", "://").replaceAll("\\", "/");
let isDebug = false;
let log = () => { }; // Dummy function

// Get page
const pagePromise = new Promise((resolve, reject) => {
    let page = window.location.hash.slice(2).split("/")[0];
    if (page && page !== "blank") {
        log("Page is:", page);
        resolve(page);
    } else {
        log("Waiting for navigation...");
        navigation.addEventListener("navigatesuccess", () => {
            page = window.location.hash.slice(2).split("/")[0];
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
function scriptHelper(path, code, enabled, comment, runAts) {
    pagePromise.then(page => {
        const result = test(path, code, enabled, page, runAts);
        log(`"${path}" injected? ${result}`);
    });
}
scriptio.onUpdateScript((event, args) => {
    scriptHelper(...args);
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
    function stem(path) { // Get the stem of a path
        // Assuming the path is separated by slash
        const parts = path.split("/");
        const last = parts.pop();
        const name = last.split(".").slice(0, -1).join(".");
        return name;
    }
    function addItem(path) { // Add a list item with name and description, returns the switch
        const item = document.createElement("setting-item");
        item.setAttribute("data-direction", "row");
        item.setAttribute(configDataAttr, path);
        container.appendChild(item);
        const left = document.createElement("div");
        item.appendChild(left);
        const itemName = document.createElement("setting-text");
        itemName.textContent = stem(path);
        itemName.title = path;
        left.appendChild(itemName);
        const itemDesc = document.createElement("setting-text");
        itemDesc.setAttribute("data-type", "secondary");
        left.appendChild(itemDesc);
        const switch_ = document.createElement("setting-switch");
        switch_.setAttribute(switchDataAttr, path);
        item.appendChild(switch_);
        switch_.addEventListener("click", () => {
            switch_.parentNode.classList.toggle("is-loading", true);
            scriptio.configChange(path, switch_.toggleAttribute("is-active")); // Update the UI immediately, so it would be more smooth
        });
        return switch_;
    }
    scriptio.onUpdateScript((event, args) => {
        const [path, code, enabled, comment] = args;
        const switch_ = $(`setting-switch[${switchDataAttr}="${path}"]`)
            || addItem(path);
        switch_.toggleAttribute("is-active", enabled);
        switch_.parentNode.classList.toggle("is-loading", false);
        const span = $(`setting-item[${configDataAttr}="${path}"] > div > setting-text[data-type="secondary"]`);
        span.textContent = comment || "* 此文件没有描述";
        if (span.textContent.startsWith("* ")) {
            span.title = "对此脚本的更改将在重载后生效";
        } else {
            span.title = "";
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
        openURI("folder", "scripts"); // Relative to the data directory
    });
    $("#scriptio-import").addEventListener("change", importScript);
    // About - Version
    $("#scriptio-version").textContent = LiteLoader.plugins.scriptio.manifest.version;
    // About - Backgroud image
    ["version", "author", "issues", "submit"].forEach(id => {
        $(`#scriptio-about-${id}`).style.backgroundImage = `url("local:///${pluginPath}/icons/${id}.svg")`;
    });
    view.querySelectorAll(".scriptio-link").forEach(link => {
        if (!link.getAttribute("title")) {
            link.setAttribute("title", link.getAttribute("data-scriptio-url"));
        }
        link.addEventListener("click", openURL);
    });
    if (pluginStore?.createBrowserWindow) {
        log("PluginStore detected");
        const link = $("#scriptio-snippets");
        link.removeEventListener("click", openURL);
        link.textContent = "侧载插件商店";
        link.title = "打开 Scriptio 侧载插件商店，或者 Ctrl + Click 打开默认的用户脚本列表";
        link.addEventListener("click", (e) => {
            if (e.ctrlKey) {
                openURL.call(link);
            } else {
                pluginStore.createBrowserWindow("scriptio");
            }
        });
    }
}

export {
    onSettingWindowCreated
}