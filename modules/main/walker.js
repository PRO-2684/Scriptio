// Walks a directory and returns a list of javascript files or a shortcut to a javascript file.
import { normalize } from "../loaders/unified.js";
import { readdirSync, lstatSync } from "fs";
import { shell } from "electron";

/** Folders to ignore. */
const ignoredFolders = new Set(["node_modules", ".git", ".vscode", ".idea", ".github"]);

/**
 * Walks a directory and returns a list of either javascript files or shortcuts to javascript files, relative to given directory.
 * @param {string} baseDir Directory to walk, ending with `/`.
 * @returns {string[]} List of javascript files or shortcuts.
 */
function listJS(baseDir) {
    const files = [];
    // `dir` must end with `/` or be empty.
    function walk(dir) {
        const dirFiles = readdirSync(baseDir +dir);
        for (const f of dirFiles) {
            const stat = lstatSync(baseDir + dir + f);
            if (stat.isDirectory()) {
                if (!ignoredFolders.has(f) && !f.startsWith(".")) { // Ignore given folders and hidden folders
                    walk(dir + f + "/");
                }
            } else if (f.endsWith(".js")) {
                files.push(normalize(dir + f));
            } else if (f.endsWith(".lnk") && shell.readShortcutLink) { // lnk file & on Windows
                const linkPath = dir + f;
                try {
                    const { target } = shell.readShortcutLink(baseDir + linkPath);
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
    walk("");
    return files;
}

export { listJS };
