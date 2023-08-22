const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scriptio", {
    rendererReady: () => ipcRenderer.send(
        "LiteLoader.scriptio.rendererReady"
    ),
    configChange: (name, enable) => ipcRenderer.send(
        "LiteLoader.scriptio.configChange",
        name, enable
    ),
    devMode: (enable) => ipcRenderer.send(
        "LiteLoader.scriptio.devMode",
        enable
    ),
    reloadScript: () => ipcRenderer.send(
        "LiteLoader.scriptio.reloadScript"
    ),
    importScript: (fname, content) => ipcRenderer.send(
        "LiteLoader.scriptio.importScript",
        fname, content
    ),
    open: (type, uri) => ipcRenderer.send(
        "LiteLoader.scriptio.open",
        type, uri
    ),
    onUpdateScript: (callback) => ipcRenderer.on(
        "LiteLoader.scriptio.updateScript",
        callback
    ),
    onResetScript: (callback) => ipcRenderer.on(
        "LiteLoader.scriptio.resetScript",
        callback
    ),
});