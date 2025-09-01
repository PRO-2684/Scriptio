// Unified API for LiteLoader & QwQNT, main & renderer

const { dataPathOrig, pluginPathOrig, scriptioVersion, configApi } = globalThis.LiteLoader ?
    await import("./liteloader.js") :
    await import("./qwqnt.js");
/** Scriptio data path, normalized to use `/`, ending with `/` */
const dataPath = normalize(dataPathOrig) + "/";
/** Scriptio script path, normalized to use `/`, ending with `/` */
const scriptPath = dataPath + "scripts/";
/** Scriptio plugin path, normalized to use `/`, ending with `/` */
const pluginPath = normalize(pluginPathOrig) + "/";

/**
 * Normalize a path to Unix style.
 * @param {string} path Path to normalize.
 * @returns {string} Normalized path.
 */
function normalize(path) {
    return path.replace(":\\", "://").replaceAll("\\", "/");
}

export {
    dataPath,
    scriptPath,
    pluginPath,
    scriptioVersion,
    /** Should only be used in main */
    configApi,
    normalize,
}
