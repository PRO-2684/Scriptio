const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, webContents } = require("electron");

const isDebug = process.argv.includes("--scriptio-debug");
const updateInterval = 1000;
const log = isDebug ? (...args) => console.log("\x1b[32m%s\x1b[0m", "[Scriptio]", ...args) : () => { };
let devMode = false;
let watcher = null;

// 加载插件时触发
const dataPath = LiteLoader.plugins.scriptio.path.data;
const scriptPath = path.join(dataPath, "scripts");

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
ipcMain.on("LiteLoader.scriptio.open", (event, type, uri) => {
    log("open", type, uri);
    switch (type) {
        case "folder": // Relative to dataPath
            LiteLoader.api.openPath(path.join(dataPath, uri));
            break;
        case "link":
            LiteLoader.api.openExternal(uri);
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
if (LiteLoader.plugins.pluginStore) {
    ipcMain.handle("LiteLoader.scriptio.isSnippetInstall", (event, file) => {
        return fs.existsSync(path.join(scriptPath, file));
    });
    ipcMain.handle("LiteLoader.scriptio.isSnippetRestart", (event, file) => {
        log("isSnippetRestart", file);
        updateScript(file);
        return false;
    });
}

// 防抖
function debounce(fn, time) {
    const timer = null;
    return function (...args) {
        timer && clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, args);
        }, time);
    }
}
function listJS(dir) {
    log("listJS", dir);
    function walk(dir, files = []) {
        const dirFiles = fs.readdirSync(dir);
        for (const f of dirFiles) {
            const stat = fs.lstatSync(dir + "/" + f);
            if (stat.isDirectory()) {
                walk(dir + "/" + f, files);
            } else if (f.endsWith(".js")) {
                files.push(dir + "/" + f);
            }
        }
        return files;
    }
    // Need relative path
    return walk(dir).map((f) => {
        f = f.slice(dir.length);
        if (f.startsWith("/")) {
            f = f.slice(1);
        }
        return f;
    });
}

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
// 获取 JS 文件内容
function getScript(relPath) {
    try {
        return fs.readFileSync(path.join(scriptPath, relPath), "utf-8");
    } catch (err) {
        return "";
    }
}
// 脚本更改
function updateScript(relPath, webContent) {
    const content = getScript(relPath);
    if (!content) return;
    const comments = getComments(content);
    let comment = comments[0] || "";
    let runAts = comments[1] || "";
    let enabled = true;
    if (comment.endsWith("[Disabled]")) {
        comment = comment.slice(0, -10).trim();
        enabled = false;
    }
    if (runAts.toLowerCase().startsWith("@run-at ")) {
        runAts = runAts.slice(8).split(",")
            .map((item) => item.trim())
            .filter((item) => item);
    } else {
        runAts = [];
    }
    log("updateScript", relPath, enabled, comment, runAts);
    if (webContent) {
        webContent.send("LiteLoader.scriptio.updateScript", [relPath, content, enabled, comment, runAts]);
    } else {
        webContents.getAllWebContents().forEach((webContent) => {
            webContent.send("LiteLoader.scriptio.updateScript", [relPath, content, enabled, comment, runAts]);
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
    for (const relPath of listJS(scriptPath)) {
        updateScript(relPath, webContent);
    }
}
// 导入脚本
function importScript(fname, content) {
    log("importScript", fname);
    const filePath = path.join(scriptPath, fname);
    fs.writeFileSync(filePath, content, "utf-8");
    if (!devMode) {
        updateScript(fname);
    }
}
// `scripts` 目录修改
function onScriptChange(eventType, filename) {
    log("onScriptChange", eventType, filename);
    reload();
}
// 监听配置修改
function onConfigChange(event, relPath, enable) {
    log("onConfigChange", relPath, enable);
    let content = getScript(relPath);
    let comment = getComments(content)[0] || "";
    const current = (comment === null) || !comment.endsWith("[Disabled]");
    if (current === enable) return;
    if (comment === null) {
        comment = "";
    } else {
        content = content.split("\n").slice(1).join("\n");
    }
    if (enable) {
        comment = comment.slice(0, -11);
    } else {
        comment += " [Disabled]";
    }
    content = `// ${comment}\n` + content;
    fs.writeFileSync(path.join(scriptPath, relPath), content, "utf-8");
    if (!devMode) {
        updateScript(relPath);
    }
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
