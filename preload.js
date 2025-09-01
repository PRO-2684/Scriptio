// ESM support in preload is not quite mature, so we use CommonJS `require` here

const { contextBridge, ipcRenderer } = require("electron");

const webContentIdPromise = ipcRenderer.invoke("PRO-2684.scriptio.queryWebContentId");
contextBridge.exposeInMainWorld("scriptio_internal", {
    rendererReady: () => ipcRenderer.send(
        "PRO-2684.scriptio.rendererReady"
    ),
    configChange: (path, enable) => ipcRenderer.send(
        "PRO-2684.scriptio.configChange",
        path, enable
    ),
    devMode: (enable) => ipcRenderer.send(
        "PRO-2684.scriptio.devMode",
        enable
    ),
    reload: () => ipcRenderer.send(
        "PRO-2684.scriptio.reload"
    ),
    importScript: (fname, content) => ipcRenderer.send(
        "PRO-2684.scriptio.importScript",
        fname, content
    ),
    removeScript: (path) => ipcRenderer.send(
        "PRO-2684.scriptio.removeScript",
        path
    ),
    open: (type, uri) => ipcRenderer.send(
        "PRO-2684.scriptio.open",
        type, uri
    ),
    queryIsDebug: () => ipcRenderer.invoke(
        "PRO-2684.scriptio.queryIsDebug"
    ),
    queryDevMode: () => ipcRenderer.invoke(
        "PRO-2684.scriptio.queryDevMode"
    ),
    fetchText: (...args) => ipcRenderer.invoke(
        "PRO-2684.scriptio.fetchText",
        ...args
    ),
    onUpdateScript: (callback) => ipcRenderer.on(
        "PRO-2684.scriptio.updateScript",
        callback
    ),
    invokeNative: async (eventName, cmdName, ...args) => {
        // https://github.com/WJZ-P/LiteLoaderQQNT-Echo-Message/blob/6e802de0b58c9c8634e2aac8f8937cf3755aaf98/src/preload.js#L60-L119
        const webContentId = await webContentIdPromise;
        return new Promise((resolve, reject) => {
            const callbackId = crypto.randomUUID();
            console.log(`[invokeNative] eventName: ${eventName}, cmdName: ${cmdName}, callbackId: ${callbackId}`);
            function callback(event, ...results) {
                if (results?.[0]?.callbackId == callbackId) {
                    ipcRenderer.off(`IPC_DOWN_${webContentId}`, callback);
                    console.log(`[invokeNative callback] eventName: ${eventName}, cmdName: ${cmdName}}, callbackId: ${callbackId}`);
                    resolve(results[1]);
                }
            };
            ipcRenderer.on(`RM_IPCTO_RENDERER${webContentId}`, callback);

            const requestMetadata = {
                type: "request",
                callbackId,
                eventName,
                peerId: webContentId,
            };
            const commandPayload = {
                cmdName,
                cmdType: "invoke",
                payload: args,
            };
            ipcRenderer.send(`RM_IPCFROM_RENDERER${webContentId}`, requestMetadata, commandPayload);
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
