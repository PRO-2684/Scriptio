const fs = require("fs");
const path = require("path");
const { BrowserWindow, ipcMain, shell, webContents } = require("electron");

let dataPath = null;
let scriptPath = null;
let devMode = false;
let watcher = null;
const isDebug = process.argv.includes("--scriptio-debug");
const updateInterval = 1000;
const log = isDebug ? console.log.bind(console, "[Scriptio]") : () => { };

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
// 获取 JS 文件的首行注释
function getDesc(code) {
    let firstLine = code.split("\n")[0].trim();
    if (firstLine.startsWith("//")) {
        return firstLine.slice(2).trim();
    } else {
        return null;
    }
}
// 获取 JS 文件内容
function getScript(name) {
    let content = "";
    try {
        content = fs.readFileSync(path.join(scriptPath, name + ".js"), "utf-8");
    } catch (err) { }
    return content;
}
// 脚本更改
function updateScript(name, webContent) {
    let content = getScript(name);
    let comment = getDesc(content) || "";
    let enabled = true;
    if (comment.endsWith("[Disabled]")) {
        comment = comment.slice(0, -10).trim();
        enabled = false;
    }
    log("updateScript", name, comment, enabled);
    if (webContent) {
        webContent.send("LiteLoader.scriptio.updateScript", [name, content, enabled, comment]);
    } else {
        webContents.getAllWebContents().forEach((webContent) => {
            webContent.send("LiteLoader.scriptio.updateScript", [name, content, enabled, comment]);
        });
    }
}
// 启用/禁用脚本
function toggleScript(name, enable) {
    log("toggleScript", name, enable);
    webContents.getAllWebContents().forEach((webContent) => {
        webContent.send("LiteLoader.scriptio.toggleScript", [name, enable]);
    });
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
    const files = fs.readdirSync(scriptPath, { withFileTypes: true }).filter((file) => file.name.endsWith(".js") && !file.isDirectory());
    files.forEach((file) => {
        updateScript(file.name.slice(0, -3), webContent);
    });
}
// 导入脚本
function importScript(fname, content) {
    log("importScript", fname);
    let filePath = path.join(scriptPath, fname);
    fs.writeFileSync(filePath, content, "utf-8");
    if (!devMode) {
        updateScript(fname.slice(0, -3));
    }
}
// `scripts` 目录修改
function onScriptChange(eventType, filename) {
    log("onScriptChange", eventType, filename);
    reload();
}
// 监听配置修改
function onConfigChange(event, name, enable) {
    log("onConfigChange", name, enable);
    let content = getScript(name);
    let comment = getDesc(content);
    let current = (comment === null) || !comment.endsWith("[Disabled]");
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
    fs.writeFileSync(path.join(scriptPath, name + ".js"), content, "utf-8");
    if (!devMode) {
        toggleScript(name, enable);
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
// 插件加载触发
async function onLoad(plugin) {
    dataPath = plugin.path.data;
    scriptPath = path.join(dataPath, "scripts/");
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
                shell.openPath(path.join(dataPath, uri));
                break;
            case "link":
                shell.openExternal(uri);
                break;
            default:
                break;
        }
    });
    ipcMain.on("LiteLoader.scriptio.configChange", onConfigChange);
    ipcMain.on("LiteLoader.scriptio.devMode", onDevMode);
    ipcMain.handle("LiteLoader.scriptio.queryIsDebug", (event) => {
        log("queryIsDebug", isDebug);
        return isDebug;
    });
    ipcMain.handle("LiteLoader.scriptio.queryDevMode", async (event) => {
        log("queryDevMode", devMode);
        return devMode;
    });
}

module.exports = {
    onLoad
}