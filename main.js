import { existsSync, mkdirSync, unlinkSync, readFileSync, writeFileSync, watch } from "fs";
import { normalize as normalize_platform, basename } from "path";
import { BrowserWindow, ipcMain, webContents, shell } from "electron";
import { extractUserScriptMetadata } from "./modules/main/parser.js";
import { listJS } from "./modules/main/walker.js";
import { debounce, simpleLog, dummyLog } from "./modules/main/utils.js";
import { normalize, configApi, scriptPath } from "./modules/loaders/unified.js";

const isDebug = process.argv.includes("--scriptio-debug");
const updateInterval = 1000;
const log = isDebug ? simpleLog : dummyLog;
let devMode = false;
let watcher = null;
const CHARTSET_RE = /(?:charset|encoding)\s{0,10}=\s{0,10}['"]? {0,10}([\w\-]{1,100})/i;

const debouncedSet = debounce(configApi.set, updateInterval);
const scriptsConfig = new Proxy(
    configApi.get().scripts, {
        get(target, prop) {
            return target[prop];
        },
        set(target, prop, value) {
            target[prop] = value;
            log("Calling debounced config.set after set");
            try {
                debouncedSet({ scripts: target });
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
                    debouncedSet({ scripts: target });
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


// Create data & `scripts` directory if not exists
if (!existsSync(scriptPath)) {
    log(`${scriptPath} does not exist, creating...`);
    mkdirSync(scriptPath, { recursive: true });
}
// IPC events
ipcMain.on("PRO-2684.scriptio.rendererReady", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    loadScripts(window.webContents);
});
ipcMain.on("PRO-2684.scriptio.reload", reload);
ipcMain.on("PRO-2684.scriptio.importScript", (event, fname, content) => {
    importScript(fname, content);
});
ipcMain.on("PRO-2684.scriptio.removeScript", (event, relPath) => {
    log("removeScript", relPath);
    unlinkSync(scriptPath + relPath);
    delete scriptsConfig[relPath];
    if (!devMode) {
        const msg = {
            path: relPath, enabled: false, code: "// Removed", meta: {
                name: " [已删除] ",
                description: "[此脚本已被删除]",
                "run-at": [],
                reactive: true
            }
        };
        webContents.getAllWebContents().forEach((webContent) => {
            webContent.send("PRO-2684.scriptio.updateScript", msg);
        });
    }
});
ipcMain.on("PRO-2684.scriptio.open", (event, type, uri) => {
    log("open", type, uri);
    switch (type) {
        case "link":
            shell.openExternal(uri);
            break;
        case "path":
            shell.openPath(normalize_platform(uri));
            break;
        case "show":
            shell.showItemInFolder(normalize_platform(uri));
            break;
        default:
            break;
    }
});
ipcMain.on("PRO-2684.scriptio.configChange", onConfigChange);
ipcMain.on("PRO-2684.scriptio.devMode", onDevMode);
ipcMain.handle("PRO-2684.scriptio.queryWebContentId", async (event) => {
    log("queryWebContentId", event.sender.id);
    return event.sender.id;
});
ipcMain.handle("PRO-2684.scriptio.queryDevMode", async (event) => {
    log("queryDevMode", devMode);
    return devMode;
});
ipcMain.handle("PRO-2684.scriptio.queryIsDebug", (event) => {
    log("queryIsDebug", isDebug);
    return isDebug;
});
ipcMain.handle("PRO-2684.scriptio.fetchText", async (event, ...args) => {
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

// Get script content
function getScript(relPath) {
    let realPath = scriptPath + relPath;
    if (realPath.endsWith(".lnk") && shell.readShortcutLink) { // lnk file & on Windows
        const { target } = shell.readShortcutLink(realPath);
        realPath = target;
    }
    try {
        return readFileSync(realPath, "utf-8");
    } catch (err) {
        log("getScript", relPath, err)
        return "";
    }
}

// Send updated script to renderer
function updateScript(relPath, webContent) {
    relPath = normalize(relPath);
    const code = getScript(relPath);
    if (!code) return;
    const enabled = scriptsConfig[relPath] ?? (scriptsConfig[relPath] = true);
    const meta = extractUserScriptMetadata(code);
    meta.name ??= basename(relPath, ".js");
    meta.description ??= "此脚本没有描述";
    meta["run-at"] = (meta["run-at"] ?? "").split(",").map((item) => item.trim()).filter((item) => item);
    meta.reactive ??= "false";
    meta.reactive = (meta.reactive.toLowerCase() === "true");
    log("updateScript", relPath);
    const msg = { path: relPath, enabled, code, meta };
    if (webContent) {
        webContent.send("PRO-2684.scriptio.updateScript", msg);
    } else {
        webContents.getAllWebContents().forEach((webContent) => {
            webContent.send("PRO-2684.scriptio.updateScript", msg);
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
    for (const relPath of scripts) {
        updateScript(relPath, webContent);
    }
    const removedScripts = new Set(Object.keys(scriptsConfig)).difference(new Set(scripts));
    for (const relPath of removedScripts) {
        log("Removed script", relPath);
        delete scriptsConfig[relPath];
    }
}

// Import script from renderer
function importScript(fname, content) {
    log("importScript", fname);
    const filePath = scriptPath + fname;
    writeFileSync(filePath, content, "utf-8");
    if (!devMode) {
        updateScript(fname);
    }
}

// Reload windows when file changes
function onScriptChange(eventType, filename) {
    log("onScriptChange", eventType, filename);
    reload();
}

// Listen to config modification (from renderer)
function onConfigChange(event, relPath, enable) {
    log("onConfigChange", relPath, enable);
    scriptsConfig[relPath] = enable;
    updateScript(relPath);
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
    return watch(scriptPath, "utf-8",
        debounce(onScriptChange, updateInterval)
    );
}
