import blessed from "blessed";

/**
 * Get the menu structure with categories and commands
 * @returns {Object} Menu structure grouped by category
 */
export function getMenuItems() {
  return {
    "🚀 Quick Actions": {
      "Quick Start Wizard": "node rps.js quickstart",
      "Fresh Start / Full Cleanup": "node rps.js cleanup",
    },
    "⚡ Redis Cluster": {
      "Setup Redis Cluster (specify nodes)": "PROMPT_REDIS_SETUP",
      "Stop Redis Cluster": "node rps.js redis stop",
      "Resume Redis Cluster": "node rps.js redis resume",
      "Clean Redis Cluster": "node rps.js redis clean",
      "Check Redis Status": "node rps.js redis status",
    },
    "🚀 PM2 Cluster": {
      "Start Cpeak (specify instances)": "PROMPT_PM2_SETUP:cpeak",
      "Start Express (specify instances)": "PROMPT_PM2_SETUP:express",
      "Start Fastify (specify instances)": "PROMPT_PM2_SETUP:fastify",
      "Stop PM2 Processes": "node rps.js pm2 stop",
      "Restart PM2 Processes": "node rps.js pm2 restart",
      "Delete PM2 Processes": "node rps.js pm2 delete",
      "View PM2 Logs": "node rps.js pm2 logs",
    },
    "💻 Dev Servers": {
      "Run Cpeak (Dev)": "node rps.js dev cpeak",
      "Run Express (Dev)": "node rps.js dev express",
      "Run Fastify (Dev)": "node rps.js dev fastify",
    },
    "📊 Benchmarks - Cpeak": {
      "GET /simple": "node bench.js -f cpeak -d 20",
      "POST /code": "node bench.js -f cpeak -e /code -m POST -d 20",
      "GET /code-fast": "node bench.js -f cpeak -e /code-fast -d 20",
    },
    "📊 Benchmarks - Express": {
      "GET /simple": "node bench.js -f express -d 20",
      "POST /code": "node bench.js -f express -e /code -m POST -d 20",
      "GET /code-fast": "node bench.js -f express -e /code-fast -d 20",
    },
    "📊 Benchmarks - Fastify": {
      "GET /simple": "node bench.js -f fastify -d 20",
    },
    "🔧 Utilities": {
      "Install Dependencies": "npm install",
    },
  };
}

/**
 * Create the menu overlay (hidden by default)
 * @param {blessed.Screen} screen - The blessed screen instance
 * @returns {Object} { overlay, list, itemToCommand }
 */
export function createMenuOverlay(screen) {
  const menuItems = getMenuItems();

  // Create semi-transparent overlay
  const overlay = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "80%",
    height: "80%",
    border: {
      type: "line",
    },
    style: {
      bg: "black",
      fg: "white",
      border: {
        fg: "cyan",
      },
    },
    label: " Menu - Use ↑↓ to navigate, Enter to select, ESC to close ",
    hidden: true,
  });

  // Flatten menu items with section tracking
  const flatItems = [];
  const itemToCommand = new Map(); // Map: "section|label" -> command

  Object.entries(menuItems).forEach(([section, items]) => {
    flatItems.push(`{bold}${section}{/bold}`);
    Object.entries(items).forEach(([label, cmd]) => {
      flatItems.push(`  ${label}`);
      itemToCommand.set(`${section}|${label}`, cmd);
    });
    flatItems.push(""); // spacer
  });

  const list = blessed.list({
    parent: overlay,
    top: 1,
    left: 1,
    width: "100%-2",
    height: "100%-2",
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      selected: {
        bg: "blue",
        fg: "white",
        bold: true,
      },
      item: {
        fg: "white",
      },
    },
    items: flatItems,
  });

  return { overlay, list, itemToCommand, flatItems };
}

/**
 * Show the menu overlay
 * @param {Object} menuComponents - { overlay, list, itemToCommand, flatItems }
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {Function} onSelect - Callback: (command, label) => void
 */
export function showMenu(menuComponents, screen, onSelect) {
  const { overlay, list, itemToCommand, flatItems } = menuComponents;

  // Remove existing select listeners to avoid duplicates
  list.removeAllListeners("select");

  // Handle selection
  list.on("select", function (item) {
    const selectedText = item.content
      .replace(/{[^}]+}/g, "")
      .trim()
      .replace(/^\s+/, "");

    // Skip section headers and empty lines
    if (!selectedText || selectedText.match(/^[🚀⚡💻📊🔧]/)) {
      return;
    }

    // Find the current section by looking backwards from selected index
    const selectedIndex =
      this && typeof this.selected === "number" ? this.selected : -1;
    if (selectedIndex < 0) {
      return;
    }

    let currentSection = null;
    for (let i = selectedIndex; i >= 0; i--) {
      const itemContent = flatItems[i].replace(/{[^}]+}/g, "").trim();
      if (itemContent.match(/^[🚀⚡💻📊🔧]/)) {
        currentSection = itemContent;
        break;
      }
    }

    // Find the command using section + label
    let command = null;
    if (currentSection) {
      command = itemToCommand.get(`${currentSection}|${selectedText}`);
    }

    if (command) {
      hideMenu(menuComponents, screen);
      onSelect(command, selectedText);
    }
  });

  overlay.show();
  list.focus();
  screen.render();
}

/**
 * Hide the menu overlay
 * @param {Object} menuComponents - { overlay, list }
 * @param {blessed.Screen} screen - The blessed screen instance
 */
export function hideMenu(menuComponents, screen) {
  const { overlay } = menuComponents;
  overlay.hide();
  screen.render();
}

/**
 * Check if menu is currently visible
 * @param {Object} menuComponents - { overlay }
 * @returns {boolean}
 */
export function isMenuVisible(menuComponents) {
  const { overlay } = menuComponents;
  return overlay && !overlay.hidden;
}
