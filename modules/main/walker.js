// Walks a directory and returns a list of javascript files or a shortcut to a javascript file.
const { normalize } = require("./utils");
const fs = require("fs");
const { shell } = require("electron");

/** Folders to ignore. */
const ignoredFolders = new Set(["node_modules", ".git", ".vscode", ".idea", ".github"]);

/**
 * Walks a directory and returns a list of either javascript files or shortcuts to javascript files.
 * @param {string} dir Directory to walk.
 * @returns {string[]} List of javascript files or shortcuts.
 */
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

module.exports = { listJS };
