// Description: Easter eggs.

/**
 * Easter eggs.
 * @type {Function[]}
 */
const eggs = [shakingWindow];


/** Skaking window easter egg.
 * @param {HTMLElement} view The settings view element.
 * @returns {void}
 */
function shakingWindow(view) {
    const logo = view.querySelector(".logo");
    function shakeWindow() {
        // Use moveBy to shake the window
        const magnitude = 10;
        const c = Math.PI / 4;
        let t = 0;
        const timer = setInterval(() => {
            const delta = magnitude * (Math.sin(c * (t + 1)) - Math.sin(c * t));
            window.moveBy(delta, 0);
            t++;
            if (t >= 16) {
                clearInterval(timer);
            }
        }, 100);
    }
    const max = 10;
    logo.addEventListener("animationend", () => {
        const cnt = parseInt(logo.style.getPropertyValue("--data-cnt"));
        if (cnt >= max) {
            shakeWindow();
        } else {
            logo.style.setProperty("--data-cnt", cnt + 1);
        }
    });
}

/** Function to setup easter eggs at the settings view.
 * @param {HTMLElement} view The settings view element.
 * @returns {void}
 */
function setupEasterEggs(view) {
    eggs.forEach(egg => egg(view));
}

export { setupEasterEggs };
