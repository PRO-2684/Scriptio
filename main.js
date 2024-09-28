const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, webContents, shell } = require("electron");
const { extractUserScriptMetadata } = require("./modules/main/parser.js");
const { listJS } = require("./modules/main/walker.js");
const { normalize, debounce, simpleLog, dummyLog } = require("./modules/main/utils");

const isDebug = process.argv.includes("--scriptio-debug");
const updateInterval = 1000;
const log = isDebug ? simpleLog : dummyLog;
let devMode = false;
let watcher = null;

const dataPath = LiteLoader.plugins.scriptio.path.data;
const scriptPath = path.join(dataPath, "scripts");
const CHARTSET_RE = /(?:charset|encoding)\s{0,10}=\s{0,10}['"]? {0,10}([\w\-]{1,100})/i;

// Create `scripts` directory if not exists
if (!fs.existsSync(scriptPath)) {
    log(`${scriptPath} does not exist, creating...`);
    fs.mkdirSync(scriptPath, { recursive: true });
}
// IPC events
ipcMain.on("LiteLoader.scriptio.rendererReady", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    loadScripts(window.webContents);
});
ipcMain.on("LiteLoader.scriptio.reload", reload);
ipcMain.on("LiteLoader.scriptio.importScript", (event, fname, content) => {
    importScript(fname, content);
});
ipcMain.on("LiteLoader.scriptio.removeScript", (event, absPath) => {
    log("removeScript", absPath);
    fs.unlinkSync(absPath);
    delete scriptsConfig[absPath];
    if (!devMode) {
        const msg = {
            path: absPath, enabled: false, code: "// Removed", meta: {
                name: " [已删除] ",
                description: "[此脚本已被删除]",
                "run-at": [],
                reactive: true
            }
        };
        webContents.getAllWebContents().forEach((webContent) => {
            webContent.send("LiteLoader.scriptio.updateScript", msg);
        });
    }
});
ipcMain.on("LiteLoader.scriptio.open", (event, type, uri) => {
    log("open", type, uri);
    switch (type) {
        case "link":
            shell.openExternal(uri);
            break;
        case "path":
            shell.openPath(path.normalize(uri));
            break;
        case "show":
            shell.showItemInFolder(path.normalize(uri));
            break;
        default:
            break;
    }
});
ipcMain.on("LiteLoader.scriptio.configChange", onConfigChange);
ipcMain.on("LiteLoader.scriptio.devMode", onDevMode);
ipcMain.handle("LiteLoader.scriptio.queryDevMode", async (event) => {
    log("queryDevMode", devMode);
    return devMode;
});
ipcMain.handle("LiteLoader.scriptio.queryIsDebug", (event) => {
    log("queryIsDebug", isDebug);
    return isDebug;
});
ipcMain.handle("LiteLoader.scriptio.fetchText", async (event, ...args) => {
    log("fetch", ...args);
    try {
        // Firing a HEAD request to check the content type
        const head = await fetch(args[0], { method: "HEAD" });
        const headContentType = head.headers.get("Content-Type");
        // Judge the content type should be text
        if (headContentType && !headContentType.startsWith("text")) {
            log(`"${args[0]}" is not text, content type: ${headContentType}`); // Not text, return empty string
            return ""; // Not text, return empty string
        }
        // Actually firing the request
        const r = await fetch(...args);
        // Detect charset from response header. Adapted from https://github.com/node-modules/charset/blob/master/index.js
        const contentType = r?.headers?.get("Content-Type");
        const match = contentType?.match(CHARTSET_RE);
        const charset = match ? match[1].toLowerCase() : "utf-8";
        log(`Charset of "${args[0]}": ${charset}`);
        const buffer = await r.arrayBuffer();
        const decoder = new TextDecoder(charset);
        const text = decoder.decode(buffer);
        return text;
    } catch (err) {
        log("fetch error", err);
        return "";
    }
});

const debouncedSet = debounce(LiteLoader.api.config.set, 1000);
const scriptsConfig = new Proxy(
    LiteLoader.api.config.get("scriptio", { scripts: {} }).scripts, {
        get(target, prop) {
            return target[prop];
        },
        set(target, prop, value) {
            target[prop] = value;
            log("Calling debounced config.set after set");
            try {
                debouncedSet("scriptio", { scripts: target });
            } catch (e) {
                log("debouncedSet error", e);
            }
            return true;
        },
        deleteProperty(target, prop) {
            if (prop in target) {
                delete target[prop];
                log("Calling debounced config.set after delete");
                try {
                    debouncedSet("scriptio", { scripts: target });
                } catch (e) {
                    log("debouncedSet error", e);
                }
                return true;
            }
            return false;
        },
        ownKeys(target) {
            return Object.keys(target);
        }
    }
);

// Get script content
function getScript(absPath) {
    if (absPath.endsWith(".lnk") && shell.readShortcutLink) { // lnk file & on Windows
        const { target } = shell.readShortcutLink(absPath);
        absPath = target;
    }
    try {
        return fs.readFileSync(absPath, "utf-8");
    } catch (err) {
        log("getScript", absPath, err)
        return "";
    }
}

// Send updated script to renderer
function updateScript(absPath, webContent) {
    absPath = normalize(absPath);
    const code = getScript(absPath);
    if (!code) return;
    const enabled = scriptsConfig[absPath] ?? (scriptsConfig[absPath] = true);
    const meta = extractUserScriptMetadata(code);
    meta.name ??= path.basename(absPath, ".js");
    meta.description ??= "此脚本没有描述";
    meta["run-at"] = (meta["run-at"] ?? "").split(",").map((item) => item.trim()).filter((item) => item);
    meta.reactive ??= "false";
    meta.reactive = (meta.reactive.toLowerCase() === "true");
    log("updateScript", absPath, enabled, meta);
    const msg = { path: absPath, enabled, code, meta };
    if (webContent) {
        webContent.send("LiteLoader.scriptio.updateScript", msg);
    } else {
        webContents.getAllWebContents().forEach((webContent) => {
            webContent.send("LiteLoader.scriptio.updateScript", msg);
        });
    }
}

// Reload all windows
function reload(event) {
    // If exists, close the sender window (settings window)
    if (event && event.sender) {
        const win = BrowserWindow.fromWebContents(event.sender);
        win.close();
    }
    BrowserWindow.getAllWindows().forEach((window) => {
        window.reload();
    });
}

// Load all scripts
function loadScripts(webContent) {
    log("loadScripts");
    const scripts = listJS(scriptPath);
    for (const absPath of scripts) {
        updateScript(absPath, webContent);
    }
    const removedScripts = new Set(Object.keys(scriptsConfig)).difference(new Set(scripts));
    for (const absPath of removedScripts) {
        log("Removed script", absPath);
        delete scriptsConfig[absPath];
    }
}

// Import script from renderer
function importScript(fname, content) {
    log("importScript", fname);
    const filePath = path.join(scriptPath, fname);
    fs.writeFileSync(filePath, content, "utf-8");
    if (!devMode) {
        updateScript(filePath);
    }
}

// Reload windows when file changes
function onScriptChange(eventType, filename) {
    log("onScriptChange", eventType, filename);
    reload();
}

// Listen to config modification (from renderer)
function onConfigChange(event, absPath, enable) {
    log("onConfigChange", absPath, enable);
    scriptsConfig[absPath] = enable;
    updateScript(absPath);
}

// Listen to dev mode switch (from renderer)
function onDevMode(event, enable) {
    log("onDevMode", enable);
    devMode = enable;
    if (enable && !watcher) {
        watcher = watchScriptChange();
        log("watcher created");
    } else if (!enable && watcher) {
        watcher.close();
        watcher = null;
        log("watcher closed");
    }
}

// Listen to `scripts` directory
function watchScriptChange() {
    return fs.watch(scriptPath, "utf-8",
        debounce(onScriptChange, updateInterval)
    );
}
