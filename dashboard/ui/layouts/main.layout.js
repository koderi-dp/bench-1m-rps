import blessed from "blessed";
import contrib from "blessed-contrib";

/**
 * Create the main blessed screen
 * @returns {blessed.Screen} The created screen instance
 */
export function createScreen() {
  const screen = blessed.screen({
    smartCSR: true,
    title: "Node 1M RPS - Live Dashboard",
    sendFocus: true,
    warnings: false,
  });

  return screen;
}

/**
 * Create the 12x12 grid layout
 * @param {blessed.Screen} screen - The blessed screen instance
 * @returns {contrib.Grid} The created grid instance
 */
export function createGrid(screen) {
  const grid = new contrib.grid({ 
    rows: 12, 
    cols: 12, 
    screen: screen 
  });

  return grid;
}

/**
 * Create the title bar widget
 * @param {contrib.Grid} grid - The grid layout instance
 * @returns {blessed.Box} The title bar widget
 */
export function createTitle(grid) {
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: " 🚀 NODE.JS 1M RPS - LIVE DASHBOARD 🚀 ",
    tags: true,
    style: {
      fg: "white",
      bg: "blue",
      bold: true,
    },
    align: "center",
  });

  return title;
}

/**
 * Setup screen quit handlers
 * @param {blessed.Screen} screen - The blessed screen instance
 */
export function setupQuitHandlers(screen) {
  screen.key(["escape", "q", "C-c"], function () {
    return process.exit(0);
  });
}
