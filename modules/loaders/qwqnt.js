const slug = "scriptio";
const dataPathOrig = qwqnt.framework.paths.data + "/" + slug;
const pluginPathOrig = qwqnt.framework.plugins[slug].meta.path;
const scriptioVersion = qwqnt.framework.plugins[slug].meta.packageJson.version;
const configApi = {
    get: () => PluginSettings.main.readConfig(slug, { styles: {} }),
    set: (config) => PluginSettings.main.writeConfig(slug, config),
};

export {
    dataPathOrig,
    pluginPathOrig,
    scriptioVersion,
    configApi,
}
