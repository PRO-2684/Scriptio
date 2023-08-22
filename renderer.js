const scriptIdPrefix = "scriptio-script-";
const configIdPrefix = "scriptio-config-";
// Normalized plugin path
const plugin_path = LiteLoader.plugins.scriptio.path.plugin.replace(":\\", "://").replaceAll("\\", "/");

// Helper function for css
function injectJS(name, code) {
    let script = document.createElement("script");
    script.id = scriptIdPrefix + name;
    script.textContent = code;
    document.body.appendChild(script);
    return script;
}
function scriptHelper(name, code, enabled, comment) {
    let current = document.getElementById(scriptIdPrefix + name);
    if (!current && enabled) {
        current = injectJS(name, code);
    }
}
async function onLoad() {
    scriptio.onUpdateScript((event, args) => {
        scriptHelper(...args);
    });
    scriptio.onResetScript(() => {
        window.location.reload();
    });
    scriptio.rendererReady();
}
async function onConfigView(view) {
    let r = await fetch(`llqqnt://local-file/${plugin_path}/settings.html`);
    view.innerHTML = await r.text();
    let container = view.querySelector("section.snippets > div.wrap");
    function addItem(name) { // Add a list item with name and description, returns the switch
        let divider = document.createElement("hr");
        divider.className = "horizontal-dividing-line";
        divider.id = configIdPrefix + name + "-divider";
        container.appendChild(divider);
        let item = document.createElement("div");
        item.className = "vertical-list-item";
        item.id = configIdPrefix + name + "-item";
        container.appendChild(item);
        let left = document.createElement("div");
        item.appendChild(left);
        let h2 = document.createElement("h2");
        h2.textContent = name;
        left.appendChild(h2);
        let span = document.createElement("span");
        span.className = "secondary-text";
        left.appendChild(span);
        let switch_ = document.createElement("div");
        switch_.className = "q-switch";
        switch_.id = configIdPrefix + name;
        item.appendChild(switch_);
        let span2 = document.createElement("span");
        span2.className = "q-switch__handle";
        switch_.appendChild(span2);
        switch_.addEventListener("click", () => {
            switch_.parentNode.classList.toggle("is-loading", true);
            scriptio.configChange(name, switch_.classList.toggle("is-active")); // Update the UI immediately, so it would be more smooth
        });
        return switch_;
    }
    scriptio.onUpdateScript((event, args) => {
        let [name, code, enabled, comment] = args;
        let switch_ = view.querySelector("#" + configIdPrefix + name)
            || addItem(name);
        switch_.classList.toggle("is-active", enabled);
        switch_.parentNode.classList.toggle("is-loading", false);
        let span = view.querySelector(`div#${configIdPrefix}${name}-item > div > span.secondary-text`);
        span.textContent = comment || "此文件没有描述";
        // console.log("[Scriptio] onUpdateScript", name, enabled); // DEBUG
    });
    // scriptio.onResetScript(() => {
    //     let items = view.querySelectorAll(`[id^="${configIdPrefix}"]`);
    //     items.forEach((item) => {
    //         item.remove();
    //     });
    // });
    function $(prop) { // Helper function for scriptio selectors
        return view.querySelector(`#scriptio-${prop}`);
    }
    function devMode() {
        let enabled = this.classList.toggle("is-active");
        scriptio.devMode(enabled);
    }
    function openURI(type, uri) {
        console.log("[Scriptio] Opening", type, uri);
        scriptio.open(type, uri);
    }
    function openURL() {
        let url = this.getAttribute("data-scriptio-url");
        openURI("link", url);
    }
    async function importScript() {
        if (this.files.length == 0) return; // No file selected
        this.parentNode.classList.toggle("is-loading", true);
        let cnt = 0;
        let promises = [];
        for (let file of this.files) {
            if (!file.name.endsWith(".css")) {
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
    $("dev").addEventListener("click", devMode);
    $("reload").addEventListener("dblclick", scriptio.reloadScript);
    $("open-folder").addEventListener("click", () => {
        openURI("folder", "scripts"); // Relative to the data directory
    });
    $("import").addEventListener("change", importScript);
    // About - Version
    $("version").textContent = LiteLoader.plugins.scriptio.manifest.version;
    view.querySelectorAll(".scriptio-link").forEach(link => {
        if (!link.getAttribute("title")) {
            link.setAttribute("title", link.getAttribute("data-scriptio-url"));
        }
        link.addEventListener("click", openURL);
    });
    // About - Backgroud image
    ["version", "author", "issues", "submit"].forEach(id => {
        $(`about-${id}`).style.backgroundImage = `url("llqqnt://local-file/${plugin_path}/icons/${id}.svg")`;
    });
}

export {
    onLoad,
    onConfigView
}