const slug = "scriptio";
const dataPathOrig = LiteLoader.plugins[slug].path.data;
const pluginPathOrig = LiteLoader.plugins[slug].path.plugin;
const scriptioVersion = LiteLoader.plugins[slug].manifest.version;
const configApi = {
    get: () => LiteLoader.api.config.get(slug, { scripts: {} }),
    set: (config) => LiteLoader.api.config.set(slug, config),
};

export {
    dataPathOrig,
    pluginPathOrig,
    scriptioVersion,
    configApi,
}
