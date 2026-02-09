import blessed from "blessed";
import {
  getEnabledFrameworks,
  getFramework,
  getBenchmarkableEndpoints
} from "../../../frameworks.config.js";

/**
 * Get the menu structure with categories and commands (dynamically generated)
 * @returns {Object} Menu structure grouped by category
 */
export function getMenuItems() {
  const frameworks = getEnabledFrameworks();
  const benchmarkableEndpoints = getBenchmarkableEndpoints();
  
  const menu = {
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
    "🚀 PM2 Cluster": {}
  };
  
  // Dynamically add PM2 start commands for each framework
  for (const fw of frameworks) {
    const fwConfig = getFramework(fw.name);
    menu["🚀 PM2 Cluster"][`Start ${fwConfig.displayName} (specify instances)`] = `PROMPT_PM2_SETUP:${fwConfig.name}`;
  }
  
  // Add common PM2 commands
  menu["🚀 PM2 Cluster"]["Stop PM2 Processes"] = "node rps.js pm2 stop";
  menu["🚀 PM2 Cluster"]["Restart PM2 Processes"] = "node rps.js pm2 restart";
  menu["🚀 PM2 Cluster"]["Delete PM2 Processes"] = "node rps.js pm2 delete";
  menu["🚀 PM2 Cluster"]["View PM2 Logs"] = "node rps.js pm2 logs";
  
  // Dynamically add Dev Servers section
  menu["💻 Dev Servers"] = {};
  for (const fw of frameworks) {
    const fwConfig = getFramework(fw.name);
    menu["💻 Dev Servers"][`Run ${fwConfig.displayName} (Dev)`] = `node rps.js dev ${fwConfig.name}`;
  }
  
  // Dynamically add Benchmark sections for each framework
  for (const fw of frameworks) {
    const fwConfig = getFramework(fw.name);
    const categoryName = `📊 Benchmarks - ${fwConfig.displayName}`;
    menu[categoryName] = {};
    
    // Add benchmarkable endpoints for this framework
    for (const endpoint of benchmarkableEndpoints) {
      const label = `${endpoint.method} ${endpoint.path}`;
      const command = `node bench.js -f ${fwConfig.name} -e ${endpoint.path} -m ${endpoint.method} -d 20`;
      menu[categoryName][label] = command;
    }
  }
  
  // Utilities
  menu["🔧 Utilities"] = {
    "Install Dependencies": "npm install",
  };
  
  return menu;
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
