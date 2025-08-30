// Search module for settings view.
import { log } from "./debug.js";

/** Attribute of `<setting-iitem>` that indicates the script is hidden by search. */
const searchHiddenDataAttr = "data-search-hidden";
/** Attribute of `<setting-switch>` that indicates its state is highlighted by search */
const atRuleHighlightDataAttr = "data-at-rule-highlight";

/** Search `keyword` in the `el` and highlight the matched text.
 * @param {Highlight} highlight The highlight object.
 * @param {HTMLElement} el The element to search.
 * @param {string} keyword The keyword to search.
 * @returns {boolean} Returns `true` if a match is found.
 */
function searchAndHighlight(highlight, el, keyword) {
    if (!el) return false;
    const textContent = el.textContent.toLowerCase();
    let isMatch = false;
    let startIndex = 0;
    let index;
    while ((index = textContent.indexOf(keyword, startIndex)) !== -1) {
        const range = new Range();
        range.setStart(el.firstChild, index);
        range.setEnd(el.firstChild, index + keyword.length);
        highlight.add(range);
        isMatch = true;
        startIndex = index + keyword.length;
    }
    return isMatch;
}
/** Search all `keywords` in the `setting-item` and highlight the matched text.
 * @param {Highlight} highlight The highlight object.
 * @param {HTMLElement} settingItem The `setting-item` element to search.
 * @param {Set<string>} keywords The keywords to search.
 * @returns {boolean} Returns `true` if all keywords are found in the `details`.
 */
function searchAllAndHighlight(highlight, settingItem, keywords) {
    const nameEl = settingItem.querySelector("setting-text");
    const descEl = settingItem.querySelector("setting-text[data-type='secondary']");
    let matches = 0;
    for (const keyword of keywords) {
        const nameMatch = searchAndHighlight(highlight, nameEl, keyword);
        const descMatch = searchAndHighlight(highlight, descEl, keyword);
        if (nameMatch || descMatch) {
            matches++;
        }
    }
    return matches === keywords.size;
}
/**
 * Check if the `details` satisfies the `atRules`.
 * 1. If `atRules` is empty or all `atRules` are matched, return `true`
 * 2. If not all `atRules` are matched, return `false`
 * @param {Set<string>} atRules The at-rules to search. (without leading `@`)
 * @param {HTMLDetailsElement} settingItem The `setting-item` element to search.
 * @returns {boolean} Returns `true` if the `details` satisfies the `atRules`.
 */
function matchAtRules(atRules, settingItem) {
    const switch_ = settingItem.querySelector(".scriptio-menu > setting-switch");
    const enabled = switch_.hasAttribute("is-active");
    let isMatch = true;
    for (const atRule of atRules) {
        switch (atRule) {
            case "enabled":
            case "on":
            case "1": // `@enabled`/`@on`/`@1`: Match if enabled
                isMatch = enabled; break;
            case "disabled":
            case "off":
            case "0": // `@disabled`/`@off`/`@0`: Match if disabled
                isMatch = !enabled; break;
            default:
                isMatch = false; // Invalid rule
        }
        if (!isMatch) break; // Stop if any rule is not matched
    }
    switch_.toggleAttribute(atRuleHighlightDataAttr, isMatch && (atRules.size > 0));
    return isMatch;
}
/** Perform search and hide the `setting-item` that doesn't match the search.
 * @param {Highlight} highlight The highlight object.
 * @param {string} text The search text.
 * @param {HTMLElement} container The container element.
 * @returns {void}
 */
function doSearch(highlight, text, container) { // Main function for searching
    log("Search", text);
    highlight.clear(); // Clear previous highlights
    const items = container.querySelectorAll("setting-item:not(.special)");
    const words = text.toLowerCase() // Convert to lowercase
        .split(" ") // Split by space
        .map(word => word.trim()) // Remove leading and trailing spaces
        .filter(word => word.length > 0); // Remove empty strings
    // Split the `words` into normal words and at-rules
    const [searchWords, atRules] = Array.from({ length: 2 }, () => new Set());
    words.forEach((word) => {
        switch (word[0]) {
            case "@":
                atRules.add(word.slice(1)); break;
            default:
                searchWords.add(word);
        }
    });
    items.forEach((settingItem) => { // Iterate through all `setting-item`s
        const isMatch = searchAllAndHighlight(highlight, settingItem, searchWords)
            && matchAtRules(atRules, settingItem);
        settingItem.toggleAttribute(searchHiddenDataAttr, !isMatch); // Hide the `details` if it doesn't match
    });
}
/** Setup the search bar for the settings view.
 * @param {HTMLElement} view The settings view.
 * @returns {Function} Returns a function to manually trigger the search (re-search).
 */
function setupSearch(view) {
    const inputTags = ["INPUT", "SELECT", "TEXTAREA"];
    const search = view.querySelector("#scriptio-search");
    const container = view.querySelector("setting-section.snippets > setting-panel > setting-list");
    const highlight = new Highlight();
    CSS.highlights.set("scriptio-search-highlight", highlight);
    document.addEventListener("keydown", (e) => {
        if (!view.checkVisibility()) return; // The setting window is not visible
        if (document.activeElement === search) { // The search bar is focused
            // Escape closes the window
            if (e.key === "Enter") { // Search
                search.scrollIntoView();
            }
        } else if (!inputTags.includes(document.activeElement.tagName)) { // Not focusing on some other input element
            // Focus on the search bar when "Enter" or "Ctrl + F" is pressed
            if (e.key === "Enter" || (e.ctrlKey && e.key === "f")) {
                e.preventDefault();
                search.focus();
                search.scrollIntoView();
            }
        }
    });
    search.addEventListener("change", () => { doSearch(highlight, search.value, container); });
    return () => { doSearch(highlight, search.value, container); };
}

export { setupSearch };
