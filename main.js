const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, webContents, shell } = require("electron");

const isDebug = process.argv.includes("--scriptio-debug");
const updateInterval = 1000;
const ignoredFolders = new Set(["node_modules"]);
const log = isDebug ? console.log.bind(console, "\x1b[38;2;0;72;91m%s\x1b[0m", "[Scriptio]") : () => { };
let devMode = false;
let watcher = null;

const dataPath = LiteLoader.plugins.scriptio.path.data;
const scriptPath = path.join(dataPath, "scripts");
const CHARTSET_RE = /(?:charset|encoding)\s{0,10}=\s{0,10}['"]? {0,10}([\w\-]{1,100})/i;

// 创建 scripts 目录 (如果不存在)
if (!fs.existsSync(scriptPath)) {
    log(`${scriptPath} does not exist, creating...`);
    fs.mkdirSync(scriptPath, { recursive: true });
}
// 监听
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

// 防抖
function debounce(fn, time) {
    let timer = null;
    return function (...args) {
        timer && clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, time);
    }
}

// 标准化路径 (Unix style)
function normalize(path) {
    return path.replace(":\\", "://").replaceAll("\\", "/");
}

// 列出 JS 文件，或指向 JS 文件的快捷方式
function listJS(dir) {
    const files = [];
    function walk(dir) {
        const dirFiles = fs.readdirSync(dir);
        for (const f of dirFiles) {
            const stat = fs.lstatSync(dir + "/" + f);
            if (stat.isDirectory()) {
                if (!ignoredFolders.has(f) && !f.startsWith(".")) { // Ignore given folders and hidden folders
                    walk(dir + "/" + f);
                }
            } else if (f.endsWith(".js")) {
                files.push(normalize(dir + "/" + f));
            } else if (f.endsWith(".lnk") && shell.readShortcutLink) { // lnk file & on Windows
                const linkPath = dir + "/" + f;
                try {
                    const { target } = shell.readShortcutLink(linkPath);
                    if (target.endsWith(".js")) {
                        files.push(normalize(linkPath));
                    }
                } catch (e) {
                    log("Failed to read shortcut", linkPath);
                }
            }
        }
        return files;
    }
    walk(dir);
    return files;
}

const debouncedSet = debounce(LiteLoader.api.config.set, 1000);
const scriptsConfig = new Proxy({}, {
    cache: null,
    get(target, prop) {
        if (!this.cache) {
            log("Calling config.get");
            this.cache = LiteLoader.api.config.get("scriptio", { scripts: {} }).scripts;
        }
        return this.cache[prop];
    },
    set(target, prop, value) {
        this.cache[prop] = value;
        log("Calling debounced config.set after set");
        try {
            debouncedSet("scriptio", { scripts: this.cache });
        } catch (e) {
            log("debouncedSet error", e);
        }
        return true;
    },
    deleteProperty(target, prop) {
        if (prop in this.cache) {
            delete this.cache[prop];
            console.log("Calling debounced config.set after delete");
            try {
                debouncedSet("scriptio", { scripts: this.cache });
            } catch (e) {
                log("debouncedSet error", e);
            }
            return true;
        }
        return false;
    }
});

// 获取 JS 文件头的注释，返回为数组
function getComments(code) {
    const lines = code.split("\n");
    const comments = [];
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith("//")) {
            comments.push(line.slice(2).trim());
        } else {
            break;
        }
    }
    return comments.slice(0, 2); // 目前只考虑前两行
}

function extractUserScriptMetadata(code) {
    const result = {};
    const userScriptRegex = /\/\/\s*=+\s*UserScript\s*=+\s*([\s\S]*?)\s*=+\s*\/UserScript\s*=+\s*/;
    const match = code.match(userScriptRegex);

    if (match) {// If the UserScript block is found
        const content = match[1];// Extract the content within the UserScript block
        const lines = content.split('\n'); // Split the content by newline

        lines.forEach(line => {
            // Regular expression to match "// @name value" pattern
            const matchLine = line.trim().match(/^\/\/\s*@(\S+)\s+(.+)$/);
            if (matchLine) {
                const name = matchLine[1]; // Extract the name
                const value = matchLine[2]; // Extract the value
                result[name] = value; // Store in the result object
            }
        });
    } else {// Fall back to the old method
        const comments = getComments(code);
        const comment = comments[0] || "";
        let runAts = comments[1] || "";
        if (runAts.toLowerCase().startsWith("@run-at ")) {
            runAts = runAts.slice(8);
            result["run-at"] = runAts;
        } else {
            result["run-at"] = "";
        }
        result["description"] = comment;
        if (comment.startsWith("* ")) {
            result["reactive"] = "false";
            result["description"] = comment.slice(2).trim();
        } else {
            result["reactive"] = "true";
        }
    }

    return result;
}

// 获取 JS 文件内容
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

// 脚本更改
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

// 重载所有窗口
function reload(event) {
    // 若有，关闭发送者窗口 (设置界面)
    if (event && event.sender) {
        const win = BrowserWindow.fromWebContents(event.sender);
        win.close();
    }
    BrowserWindow.getAllWindows().forEach((window) => {
        window.reload();
    });
}

// 载入脚本
function loadScripts(webContent) {
    log("loadScripts");
    const scripts = listJS(scriptPath);
    for (const absPath of scripts) {
        updateScript(absPath, webContent);
    }
}

// 导入脚本
function importScript(fname, content) {
    log("importScript", fname);
    const filePath = path.join(scriptPath, fname);
    fs.writeFileSync(filePath, content, "utf-8");
    if (!devMode) {
        updateScript(filePath);
    }
}

// 监听 `scripts` 目录修改
function onScriptChange(eventType, filename) {
    log("onScriptChange", eventType, filename);
    reload();
}

// 监听配置修改
function onConfigChange(event, absPath, enable) {
    log("onConfigChange", absPath, enable);
    scriptsConfig[absPath] = enable;
    updateScript(absPath);
}

// 监听开发者模式开关
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

// 监听目录更改
function watchScriptChange() {
    return fs.watch(scriptPath, "utf-8",
        debounce(onScriptChange, updateInterval)
    );
}
