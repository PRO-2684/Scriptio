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
    reload: () => ipcRenderer.send(
        "LiteLoader.scriptio.reload"
    ),
    importScript: (fname, content) => ipcRenderer.send(
        "LiteLoader.scriptio.importScript",
        fname, content
    ),
    open: (type, uri) => ipcRenderer.send(
        "LiteLoader.scriptio.open",
        type, uri
    ),
    queryIsDebug: () => ipcRenderer.invoke(
        "LiteLoader.scriptio.queryIsDebug"
    ),
    queryDevMode: () => ipcRenderer.invoke(
        "LiteLoader.scriptio.queryDevMode"
    ),
    onUpdateScript: (callback) => ipcRenderer.on(
        "LiteLoader.scriptio.updateScript",
        callback
    ),
    onToggleScript: (callback) => ipcRenderer.on(
        "LiteLoader.scriptio.toggleScript",
        callback
    ),
});