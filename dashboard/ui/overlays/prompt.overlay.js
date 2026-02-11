import blessed from "blessed";
import { info as logInfo, error as logError, warn as logWarn } from "../../services/logger.service.js";
/**
 * Show Redis setup prompt
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {Function} onSubmit - Callback: (nodeCount) => Promise<void>
 */
export function promptRedisSetup(screen, onSubmit) {
  // Create input overlay
  const overlay = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "60%",
    height: 9,
    border: {
      type: "line",
    },
    style: {
      bg: "black",
      fg: "white",
      border: {
        fg: "yellow",
      },
    },
    label: " Setup Redis Cluster ",
  });

  const message = blessed.text({
    parent: overlay,
    top: 0,
    left: 2,
    content: "Enter number of nodes (e.g., 6, 9, 12):",
    style: {
      fg: "cyan",
    },
  });

  const textbox = blessed.textbox({
    parent: overlay,
    top: 2,
    left: 2,
    width: "100%-4",
    height: 3,
    border: {
      type: "line",
    },
    style: {
      bg: "black",
      fg: "white",
      border: {
        fg: "green",
      },
      focus: {
        border: {
          fg: "yellow",
        },
      },
    },
    keys: true,
    mouse: true,
    inputOnFocus: true,
  });

  const hint = blessed.text({
    parent: overlay,
    top: 5,
    left: 2,
    content: "Press Enter to confirm, ESC to cancel",
    style: {
      fg: "gray",
    },
  });

  // Handle submit
  textbox.on("submit", async (value) => {
    screen.remove(overlay);

    if (!value || value.trim() === "") {
      screen.render();
      return;
    }

    const nodeCount = parseInt(value);

    // Validate input
    if (isNaN(nodeCount) || nodeCount < 3) {
      logError(`Invalid node count: ${value} (minimum 3)`, {
        source: "ui",
        component: "prompt",
        action: "redis_setup_validation",
      });
      screen.render();
      return;
    }

    // Redis cluster needs at least 3 masters
    // Try different replica configurations: 0, 1, 2, 3 replicas per master
    const validTopologies = [
      { nodes: nodeCount, replicas: 0, masters: nodeCount }, // No replicas (3, 4, 5... nodes)
      { nodes: nodeCount, replicas: 1, masters: nodeCount / 2 }, // 1 replica each (6, 8, 10... nodes)
      { nodes: nodeCount, replicas: 2, masters: nodeCount / 3 }, // 2 replicas each (9, 12, 15... nodes)
      { nodes: nodeCount, replicas: 3, masters: nodeCount / 4 }, // 3 replicas each (12, 16, 20... nodes)
    ].filter((t) => Number.isInteger(t.masters) && t.masters >= 3);

    if (validTopologies.length === 0) {
      logError(`Invalid topology: ${nodeCount} nodes cannot form a valid cluster`, {
        source: "ui",
        component: "prompt",
        action: "redis_setup_validation",
      });
      logInfo("Try: 3 (no replicas), 6 (1 replica each), 9 (2 replicas each), etc.", {
        source: "ui",
        component: "prompt",
        action: "redis_setup_hint",
      });
      screen.render();
      return;
    }

    // Use the first valid topology
    const topology = validTopologies[0];
    const command = `node api/scripts/redis.js -setup -n ${nodeCount} -r ${topology.replicas}`;

    if (topology.replicas === 0) {
      logInfo(`Setting up ${nodeCount}-node cluster (${topology.masters} masters, no replicas)`, {
        source: "ui",
        component: "prompt",
        action: "redis_setup",
        nodes: nodeCount,
        masters: topology.masters,
        replicas: 0,
      });
    } else {
      logInfo(
        `Setting up ${nodeCount}-node cluster (${topology.masters} masters, ${topology.replicas} replicas each)`,
        {
          source: "ui",
          component: "prompt",
          action: "redis_setup",
          nodes: nodeCount,
          masters: topology.masters,
          replicas: topology.replicas,
        }
      );
    }

    await onSubmit(nodeCount, topology.replicas);
  });

  // Handle cancel
  textbox.on("cancel", () => {
    screen.remove(overlay);
    screen.render();
  });

  textbox.key("escape", () => {
    screen.remove(overlay);
    screen.render();
  });

  screen.append(overlay);
  textbox.focus();
  textbox.setValue("6"); // Default value
  textbox.readInput();
  screen.render();
}

/**
 * Show PM2 instance count prompt
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {string} framework - The framework name (cpeak, express, fastify)
 * @param {Function} onSubmit - Callback: (command, label) => Promise<void>
 */
export function promptPM2Setup(screen, framework, onSubmit) {
  const overlay = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: 60,
    height: 8,
    border: {
      type: "line",
    },
    style: {
      bg: "black",
      border: {
        fg: "cyan",
      },
    },
  });

  const question = blessed.text({
    parent: overlay,
    top: 1,
    left: 2,
    content: `Start ${framework} with how many instances?`,
    style: {
      fg: "cyan",
      bold: true,
    },
  });

  const textbox = blessed.textbox({
    parent: overlay,
    top: 2,
    left: 2,
    width: "100%-4",
    height: 3,
    border: {
      type: "line",
    },
    style: {
      bg: "black",
      fg: "white",
      border: {
        fg: "green",
      },
      focus: {
        border: {
          fg: "yellow",
        },
      },
    },
    keys: true,
    mouse: true,
    inputOnFocus: true,
  });

  const hint = blessed.text({
    parent: overlay,
    top: 5,
    left: 2,
    content: "Press Enter to confirm, ESC to cancel",
    style: {
      fg: "gray",
    },
  });

  // Handle submit
  textbox.on("submit", async (value) => {
    screen.remove(overlay);

    if (!value || value.trim() === "") {
      screen.render();
      return;
    }

    const instances = parseInt(value);

    // Validate input
    if (isNaN(instances) || instances < 1) {
      logError(`Invalid instance count: ${value} (minimum 1)`, {
        source: "ui",
        component: "prompt",
        action: "pm2_setup_validation",
        framework,
      });
      screen.render();
      return;
    }

    // Warn for large instance counts
    if (instances > 100) {
      logWarn(`${instances} is a very large number of instances!`, {
        source: "ui",
        component: "prompt",
        action: "pm2_setup_validation",
        framework,
        instances,
      });
      screen.render();
      return;
    }

    logInfo(`Starting ${framework} with ${instances} instances...`, {
      source: "ui",
      component: "prompt",
      action: "pm2_start",
      framework,
      instances,
    });
    await onSubmit(framework, instances);
  });

  // Handle cancel
  textbox.on("cancel", () => {
    screen.remove(overlay);
    screen.render();
  });

  textbox.key("escape", () => {
    screen.remove(overlay);
    screen.render();
  });

  screen.append(overlay);
  textbox.focus();
  textbox.setValue(""); // Empty default
  textbox.readInput();
  screen.render();
}

/**
 * Show API connect prompt
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {string} currentUrl - Current API URL (pre-filled placeholder)
 * @param {Function} onSubmit - Callback: (url) => Promise<void>
 */
export function promptAPIConnect(screen, currentUrl, onSubmit) {
  const overlay = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "70%",
    height: 10,
    border: {
      type: "line",
    },
    style: {
      bg: "black",
      fg: "white",
      border: {
        fg: "yellow",
      },
    },
    label: " Connect to API ",
  });

  const message = blessed.text({
    parent: overlay,
    top: 0,
    left: 2,
    content: "Enter API URL (e.g. http://localhost:3100 or http://192.168.1.100:3100):",
    style: {
      fg: "cyan",
    },
  });

  const textbox = blessed.textbox({
    parent: overlay,
    top: 2,
    left: 2,
    width: "100%-4",
    height: 3,
    border: {
      type: "line",
    },
    style: {
      bg: "black",
      fg: "white",
      border: {
        fg: "green",
      },
      focus: {
        border: {
          fg: "yellow",
        },
      },
    },
    keys: true,
    mouse: true,
    inputOnFocus: true,
  });

  const hint = blessed.text({
    parent: overlay,
    top: 6,
    left: 2,
    content: "Press Enter to connect, ESC to cancel",
    style: {
      fg: "gray",
    },
  });

  textbox.on("submit", async (value) => {
    screen.remove(overlay);

    const url = value?.trim() || "";
    if (!url) {
      screen.render();
      return;
    }

    // Validate URL format
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("URL must use http or https");
      }
    } catch (err) {
      logError(`Invalid API URL: ${url}`, {
        source: "ui",
        component: "prompt",
        action: "api_connect_validation",
      });
      screen.render();
      return;
    }

    await onSubmit(url);
    screen.render();
  });

  textbox.on("cancel", () => {
    screen.remove(overlay);
    screen.render();
  });

  textbox.key("escape", () => {
    screen.remove(overlay);
    screen.render();
  });

  screen.append(overlay);
  textbox.focus();
  textbox.setValue(currentUrl);
  textbox.readInput();
  screen.render();
}
