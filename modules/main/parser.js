// Scriptio's parser module for UserScript metadata extraction.

/** Get the first two lines of a script. (will be deprecated)
 * @param {string} code The code of the script.
 * @returns {Array} The first two lines of the script.
 */
function getComments(code) {
    const lines = code.split("\n");
    const comments = [];
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith("//")) {
            comments.push(line.slice(2).trim());
        } else {
            break;
        }
    }
    return comments.slice(0, 2); // Only consider the first two comments for now.
}
/** Extract the metadata of a UserScript.
 * @param {string} code The code of the UserScript.
 * @returns {Object} The metadata of the UserScript.
 */
function extractUserScriptMetadata(code) {
    const result = {};
    const userScriptRegex = /\/\/\s*=+\s*UserScript\s*=+\s*([\s\S]*?)\s*=+\s*\/UserScript\s*=+\s*/;
    const match = code.match(userScriptRegex);

    if (match) {// If the UserScript block is found
        const content = match[1];// Extract the content within the UserScript block
        const lines = content.split('\n'); // Split the content by newline

        lines.forEach(line => {
            // Regular expression to match "// @name value" pattern
            const matchLine = line.trim().match(/^\/\/\s*@(\S+)\s+(.+)$/);
            if (matchLine) {
                const name = matchLine[1]; // Extract the name
                const value = matchLine[2]; // Extract the value
                result[name] = value; // Store in the result object
            }
        });
    } else {// Fall back to the old method
        const comments = getComments(code);
        const comment = comments[0] || "";
        let runAts = comments[1] || "";
        if (runAts.toLowerCase().startsWith("@run-at ")) {
            runAts = runAts.slice(8);
            result["run-at"] = runAts;
        } else {
            result["run-at"] = "";
        }
        result["description"] = comment;
        if (comment.startsWith("* ")) {
            result["reactive"] = "false";
            result["description"] = comment.slice(2).trim();
        } else {
            result["reactive"] = "true";
        }
    }
    return result;
}

module.exports = { extractUserScriptMetadata };
