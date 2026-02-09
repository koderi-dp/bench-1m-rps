import blessed from "blessed";

/**
 * Create and show the selection overlay for copying log content
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {string} logContent - The log content to display
 * @returns {blessed.Box} The selection overlay
 */
export function openSelectionOverlay(screen, logContent) {
  // Disable mouse on screen to allow terminal selection
  screen.program.disableMouse();

  // Create a fullscreen text box overlay
  const selectionOverlay = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: {
      type: "line",
    },
    style: {
      bg: "black",
      border: {
        fg: "green",
      },
      fg: "green",
    },
    label: " 📋 SELECT & COPY MODE - Use mouse to select, Ctrl+Shift+C to copy, ESC to close ",
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    input: true,
    scrollbar: {
      ch: " ",
      inverse: true,
      style: {
        bg: "green",
      },
    },
  });

  // Add instructions at the top
  const instructions = blessed.box({
    parent: selectionOverlay,
    top: 0,
    left: 1,
    width: "100%-2",
    height: 4,
    content:
      "{cyan-fg}{bold}HOW TO COPY:{/bold}{/cyan-fg}\n" +
      "  1. Click and drag with your mouse to select text\n" +
      "  2. Copy: Ctrl+Shift+C (Linux/Mac) or Ctrl+C (Windows)\n" +
      "  3. Press ESC or Q when done",
    tags: true,
    style: {
      fg: "yellow",
    },
  });

  const logDisplay = blessed.box({
    parent: selectionOverlay,
    top: 4,
    left: 1,
    width: "100%-2",
    height: "100%-5",
    content: logContent,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    input: true,
    scrollbar: {
      ch: " ",
      inverse: true,
      style: {
        bg: "green",
      },
    },
    style: {
      fg: "green",
    },
  });

  screen.append(selectionOverlay);
  selectionOverlay.focus();
  screen.render();

  return selectionOverlay;
}

/**
 * Close the selection overlay and re-enable mouse
 * @param {blessed.Box} overlay - The selection overlay
 * @param {blessed.Screen} screen - The blessed screen instance
 */
export function closeSelectionOverlay(overlay, screen) {
  if (overlay) {
    screen.program.enableMouse();
    screen.remove(overlay);
    screen.render();
  }
}

/**
 * Get log content in plain text format (strip colors)
 * @param {blessed.Log} logWidget - The log widget
 * @returns {string} Plain text log content
 */
export function getLogContent(logWidget) {
  const logContent = logWidget.getContent();
  const lines = logContent.split("\n").filter((line) => line.trim());
  return lines.join("\n");
}
