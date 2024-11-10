const { contextBridge, ipcRenderer } = require("electron");

const webContentIdPromise = ipcRenderer.invoke("LiteLoader.scriptio.queryWebContentId");

contextBridge.exposeInMainWorld("scriptio_internal", {
    rendererReady: () => ipcRenderer.send(
        "LiteLoader.scriptio.rendererReady"
    ),
    configChange: (path, enable) => ipcRenderer.send(
        "LiteLoader.scriptio.configChange",
        path, enable
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
    removeScript: (path) => ipcRenderer.send(
        "LiteLoader.scriptio.removeScript",
        path
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
    fetchText: (...args) => ipcRenderer.invoke(
        "LiteLoader.scriptio.fetchText",
        ...args
    ),
    onUpdateScript: (callback) => ipcRenderer.on(
        "LiteLoader.scriptio.updateScript",
        callback
    ),
    invokeNative: async (eventName, cmdName, isRegister, ...args) => {
        // https://github.com/xtaw/LiteLoaderQQNT-Euphony/blob/899c0de2552cb63aa8bcfcae7e4af9333e35510b/src/main/preload.js#L10-L35
        const webContentId = await webContentIdPromise;
        return new Promise((resolve, reject) => {
            const callbackId = crypto.randomUUID();
            console.log(`invokeNative: ${eventName}-${webContentId}${isRegister ? '-register' : ''}, cmdName: ${cmdName}`, callbackId);
            function callback(event, ...args) {
                console.log(`invokeNative callback: ${eventName}-${webContentId}${isRegister ? '-register' : ''}`, args);
                if (args?.[0]?.callbackId == callbackId) {
                    ipcRenderer.off(`IPC_DOWN_${webContentId}`, callback);
                    console.log(`invokeNative callback resolved: ${eventName}-${webContentId}${isRegister ? '-register' : ''}`, callbackId);
                    resolve(args[1]);
                }
            };
            ipcRenderer.on(`IPC_DOWN_${webContentId}`, callback);
            ipcRenderer.send(`IPC_UP_${webContentId}`, {
                type: 'request',
                callbackId,
                eventName: `${eventName}-${webContentId}${isRegister ? '-register' : ''}`
            }, [cmdName, ...args]);
        });
    },
    ipcRenderer: { // https://www.electronjs.org/docs/latest/breaking-changes#behavior-changed-ipcrenderer-can-no-longer-be-sent-over-the-contextbridge
        on: (channel, listener) => ipcRenderer.on(channel, listener),
        off: (channel, listener) => ipcRenderer.off(channel, listener),
        once: (channel, listener) => ipcRenderer.once(channel, listener),
        addListener: (channel, listener) => ipcRenderer.addListener(channel, listener),
        removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        sendSync: (channel, ...args) => ipcRenderer.sendSync(channel, ...args),
        postMessage: (channel, message, transfer) => ipcRenderer.postMessage(channel, message, transfer),
        sendToHost: (channel, ...args) => ipcRenderer.sendToHost(channel, ...args),
    }
});
