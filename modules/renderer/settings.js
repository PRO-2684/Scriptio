// Description: The renderer script for the settings view of Scriptio.
import { log, showDebugHint } from "./debug.js";
import { setupSearch } from "./search.js";

/** Scriptio plugin path */
const pluginPath = LiteLoader.plugins.scriptio.path.plugin.replace(":\\", "://").replaceAll("\\", "/"); // Normalized plugin path
/** Scriptio data path */
const dataPath = LiteLoader.plugins.scriptio.path.data.replace(":\\", "://").replaceAll("\\", "/");
/** Attribute of `<setting-item>` that stores the script path */
const configDataAttr = "data-scriptio-config";
/** Attribute of `<setting-switch>` that stores the script path */
const switchDataAttr = "data-scriptio-switch";
/** Attribute of `<setting-item>` that indicates the script is deleted */
const deletedDataAttr = "data-deleted";

/** Function to add a button to the right side of the setting item.
 * @param {Element} right The right side element.
 * @param {Object} args The `icon`, `title`, and `className` of the button.
 * @returns {Element} The added button.
 */
function addScriptioMore(right, args) {
    const more = right.appendChild(document.createElement("span"));
    more.textContent = args.icon;
    more.classList.add("scriptio-more", args.className);
    more.title = args.title;
    return more;
}
/** Function to add a item representing the UserScript with name and description.
 * @param {string} path The path of the javascript file.
 * @param {Element} container The container to add the item.
 * @returns {Element} The added `setting-item` element.
 */
function addItem(path, container) {
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
    const homepage = addScriptioMore(right, { icon: "🔗", title: "打开脚本主页", className: "scriptio-homepage"});
    homepage.addEventListener("click", () => {
        if (!item.hasAttribute(deletedDataAttr) && !homepage.hasAttribute("disabled")) {
            scriptio_internal.open("link", homepage.getAttribute("data-homepage-url"));
        }
    });
    const remove = addScriptioMore(right, { icon: "🗑️", title: "删除此脚本", className: "scriptio-remove"});
    remove.addEventListener("click", () => {
        if (!item.hasAttribute(deletedDataAttr)) {
            scriptio_internal.removeScript(path);
        }
    });
    const showInFolder = addScriptioMore(right, { icon: "📂", title: "在文件夹中显示", className: "scriptio-folder"});
    showInFolder.addEventListener("click", () => {
        if (!item.hasAttribute(deletedDataAttr)) {
            scriptio_internal.open("show", path);
        }
    });
    const switch_ = right.appendChild(document.createElement("setting-switch"));
    switch_.setAttribute(switchDataAttr, path);
    switch_.title = "启用/禁用此脚本";
    switch_.addEventListener("click", () => {
        if (!item.hasAttribute(deletedDataAttr)) {
            switch_.parentNode.classList.toggle("is-loading", true);
            scriptio_internal.configChange(path, switch_.toggleAttribute("is-active")); // Update the UI immediately, so it would be more smooth
        }
    });
    return item;
}
/** Function to setup the easter egg at the settings view.
 * @param {HTMLElement} logo The logo element.
 * @returns {void}
 */
function setupEasterEgg(logo) {
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
}
/** Function to initialize the settings view.
 * @param {Element} view The settings view element.
 * @returns {Promise<Element>} The container to add the items.
 */
async function initScriptioSettings(view) {
    const r = await fetch(`local:///${pluginPath}/settings.html`);
    const $ = view.querySelector.bind(view);
    view.innerHTML = await r.text();
    function devMode() {
        const enabled = this.toggleAttribute("is-active");
        scriptio_internal.devMode(enabled);
    }
    function openURI(type, uri) {
        console.log("[Scriptio] Opening", type, uri);
        scriptio_internal.open(type, uri);
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
                    scriptio_internal.importScript(file.name, reader.result);
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
    // Search
    setupSearch(view);
    // Dev mode
    const dev = $("#scriptio-dev");
    dev.addEventListener("click", devMode);
    scriptio_internal.queryDevMode().then(enabled => {
        log("queryDevMode", enabled);
        dev.toggleAttribute("is-active", enabled);
    });
    // Debug mode
    showDebugHint(view);
    // Buttons
    $("#scriptio-reload").addEventListener("dblclick", scriptio_internal.reload);
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
    setupEasterEgg(logo);
    // Links
    view.querySelectorAll(".scriptio-link").forEach(link => {
        if (!link.getAttribute("title")) {
            link.setAttribute("title", link.getAttribute("data-scriptio-url"));
        }
        link.addEventListener("click", openURL);
    });
    const container = $("setting-section.snippets > setting-panel > setting-list");
    return container;
}
/** Function to handle `updateScript` event on settings view.
 * @param {Element} container The settings container.
 * @param {Object} args The arguments of the event.
 * @returns {void}
 */
function scriptioSettingsUpdateScript(container, args) {
    const { path, meta, enabled } = args;
    const isDeleted = meta.name === " [已删除] ";
    const item = container.querySelector(`setting-item[${configDataAttr}="${path}"]`) || addItem(path, container);
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
        item.toggleAttribute(deletedDataAttr, true);
    }
    log("scriptioSettingsUpdateScript", path, enabled);
}

export { initScriptioSettings, scriptioSettingsUpdateScript }
