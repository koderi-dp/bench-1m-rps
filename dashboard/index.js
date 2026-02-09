#!/usr/bin/env node

import blessed from "blessed";

// Logger
import { 
  info as logInfo,
  error as logError,
  closeLogger 
} from "./services/logger.service.js";

// Services
import { PM2Service } from "./services/pm2.service.js";
import { RedisService } from "./services/redis.service.js";
import { SystemService } from "./services/system.service.js";
import { BenchmarkService } from "./services/benchmark.service.js";

// UI - Layouts
import { createScreen, createGrid, createTitle } from "./ui/layouts/main.layout.js";

// UI - Widgets
import { createCPUChart, createMemoryChart, ChartDataManager } from "./ui/widgets/charts.js";
import { createPM2List } from "./ui/widgets/pm2List.js";
import { createRedisList } from "./ui/widgets/redisList.js";
import { createSystemInfo } from "./ui/widgets/systemInfo.js";
import { createBenchmarkTable } from "./ui/widgets/benchmarkTable.js";
import { createActivityLog } from "./ui/widgets/activityLog.js";

// UI - Overlays
import { createMenuOverlay, showMenu, hideMenu } from "./ui/overlays/menu.overlay.js";
import { createBenchmarkOverlay, showBenchmarkDetails, hideBenchmarkDetails } from "./ui/overlays/benchmark.overlay.js";
import { openSelectionOverlay, closeSelectionOverlay, getLogContent } from "./ui/overlays/selection.overlay.js";
import { promptRedisSetup, promptPM2Setup } from "./ui/overlays/prompt.overlay.js";

// Controllers
import { UpdateController } from "./controllers/update.controller.js";
import { NavigationController } from "./controllers/navigation.controller.js";
import { CommandController } from "./controllers/command.controller.js";

// State
import * as dashboardState from "./state/dashboard.state.js";

// ==================== INITIALIZATION ====================

// Create screen and grid
const screen = createScreen();
const grid = createGrid(screen);

// Create title
const title = createTitle(grid);

// Create services
const pm2Service = new PM2Service();
const redisService = new RedisService();
const systemService = new SystemService();
const benchmarkService = new BenchmarkService();

const services = {
  pm2: pm2Service,
  redis: redisService,
  system: systemService,
  benchmark: benchmarkService,
};

// Create widgets
const cpuChart = createCPUChart(grid);
const memoryChart = createMemoryChart(grid);
const pm2List = createPM2List(grid);
const redisList = createRedisList(grid);
const systemInfo = createSystemInfo(grid);
const benchmarkTable = createBenchmarkTable(grid);
const activityLog = createActivityLog(grid);

const widgets = {
  cpuChart,
  memoryChart,
  pm2List,
  redisList,
  systemInfo,
  benchmarkTable,
  activityLog,
};

// Create chart data manager
const chartDataManager = new ChartDataManager();

// Create footer
const footer = blessed.text({
  parent: screen,
  bottom: 0,
  left: 1,
  width: "100%-2",
  height: 1,
  content:
    "Left/Right: switch panels | Up/Down: scroll | m: menu | b: benchmarks | s/c: copy logs | Ctrl-C: exit",
  style: {
    fg: "white",
    bg: "black",
  },
});

// ==================== CONTROLLERS ====================

const updateController = new UpdateController(services, chartDataManager, screen);

const focusablePanels = [pm2List, redisList, benchmarkTable, activityLog];
const navigationController = new NavigationController(screen, focusablePanels);

const commandController = new CommandController(updateController);

// ==================== OVERLAYS ====================

const menuComponents = createMenuOverlay(screen);
const benchComponents = createBenchmarkOverlay(screen, benchmarkService);

// ==================== KEYBOARD SHORTCUTS ====================

/**
 * Cleanup function - unsubscribe all event listeners
 */
function cleanup() {
  // Stop update loop
  updateController.stopLoop();
  
  // Unsubscribe all widget event listeners
  if (cpuChart._eventUnsubscribe) cpuChart._eventUnsubscribe();
  if (memoryChart._eventUnsubscribe) memoryChart._eventUnsubscribe();
  if (pm2List._eventUnsubscribe) pm2List._eventUnsubscribe();
  if (redisList._eventUnsubscribe) redisList._eventUnsubscribe();
  if (systemInfo._eventUnsubscribe) systemInfo._eventUnsubscribe();
  if (benchmarkTable._eventUnsubscribe) benchmarkTable._eventUnsubscribe();
  if (activityLog._loggerUnsubscribe) activityLog._loggerUnsubscribe();
}

/**
 * Check if log panel is currently focused
 */
function isLogPanelActive() {
  return navigationController.isPanelFocused(activityLog);
}

/**
 * Handle menu command selection
 */
async function handleMenuCommand(command, label) {
  // Clear menu state since it's being hidden by the menu select handler
  dashboardState.setMenuOverlay(null);
  
  // Handle special prompt commands
  if (command === "PROMPT_REDIS_SETUP") {
    promptRedisSetup(screen, async (cmd, lbl) => {
      await commandController.execute(cmd, lbl);
    });
  } else if (command.startsWith("PROMPT_PM2_SETUP:")) {
    const framework = command.split(":")[1];
    promptPM2Setup(screen, framework, async (cmd, lbl) => {
      await commandController.execute(cmd, lbl);
    });
  } else {
    // Regular command
    await commandController.execute(command, label);
  }
}

// ESC - Close top overlay
screen.key(["escape"], function () {
  const components = {
    menu: { hideMenu },
    benchmark: { hideBenchmarkDetails },
    selection: { closeSelectionOverlay },
  };
  dashboardState.closeTopOverlay(screen, components);
});

// Q / Ctrl-C - Quit (or close overlay if one is open)
screen.key(["q", "C-c"], async function () {
  const components = {
    menu: { hideMenu },
    benchmark: { hideBenchmarkDetails },
    selection: { closeSelectionOverlay },
  };
  
  if (dashboardState.closeTopOverlay(screen, components)) {
    return;
  }
  
  // Graceful shutdown
  cleanup();
  logInfo("Dashboard stopped", {
    source: "dashboard",
    action: "shutdown",
    reason: "user_exit",
  });
  await closeLogger();
  return process.exit(0);
});

// R - Refresh dashboard
screen.key(["r"], async function () {
  if (dashboardState.hasBlockingOverlay()) return;
  await updateController.refresh();
  screen.render();
});

// M - Toggle menu
screen.key(["m"], function () {
  if (dashboardState.state.selectionOverlay || dashboardState.state.benchDetailsOverlay) {
    return;
  }

  if (dashboardState.state.menuOverlay) {
    hideMenu(menuComponents, screen);
    dashboardState.setMenuOverlay(null);
  } else {
    showMenu(menuComponents, screen, handleMenuCommand);
    dashboardState.setMenuOverlay(menuComponents);
  }
});

// B - Show benchmark details
screen.key(["b", "B"], async function () {
  if (dashboardState.state.menuOverlay || dashboardState.state.selectionOverlay) {
    return;
  }

  if (dashboardState.state.benchDetailsOverlay) {
    hideBenchmarkDetails(benchComponents, screen);
    dashboardState.setBenchDetailsOverlay(null);
  } else {
    const onClear = async () => {
      await benchmarkService.clear();
      logInfo("Benchmark history cleared", {
        source: "ui",
        controller: "benchmark",
        action: "clear_history",
      });
      await updateController.updateBenchmark();
    };

    const result = await showBenchmarkDetails(benchComponents, screen, benchmarkService, onClear);
    
    if (result === null) {
      logInfo("No benchmark history available", {
        source: "ui",
        controller: "benchmark",
        action: "open_benchmark_details",
      });
    } else {
      dashboardState.setBenchDetailsOverlay(benchComponents);
    }
  }
});

// Left/Right - Navigate panels
screen.key(["left", "right"], function (_, key) {
  if (dashboardState.hasBlockingOverlay()) return;
  
  if (key.name === "left") {
    navigationController.focusPrevious();
  } else {
    navigationController.focusNext();
  }
});

// S / C - Open log selection overlay
screen.key(["s", "c"], function () {
  if (!isLogPanelActive() || dashboardState.hasBlockingOverlay()) return;

  const logContent = getLogContent(activityLog);
  const overlay = openSelectionOverlay(screen, logContent);
  dashboardState.setSelectionOverlay(overlay);
  
  // Handle ESC in selection overlay
  overlay.key(["escape", "q"], () => {
    closeSelectionOverlay(overlay, screen);
    dashboardState.setSelectionOverlay(null);
  });
});

// ==================== START ====================

// Log startup
logInfo("Dashboard started", {
  source: "dashboard",
  action: "startup",
  node_version: process.version,
  platform: process.platform,
  arch: process.arch,
});

// Set initial focus
navigationController.setFocusedPanel(0);
logInfo("Dashboard started - Left/Right switch panels, 'm' opens menu", {
  source: "ui",
  action: "startup_message",
});

// Initial render
screen.render();

// Start update loop (every 2 seconds)
updateController.startLoop(2000);

// Handle process termination
process.on("SIGINT", async () => {
  cleanup();
  logInfo("Dashboard stopped", {
    source: "dashboard",
    action: "shutdown",
    reason: "SIGINT",
  });
  await closeLogger();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  cleanup();
  logInfo("Dashboard stopped", {
    source: "dashboard",
    action: "shutdown",
    reason: "SIGTERM",
  });
  await closeLogger();
  process.exit(0);
});

process.on("uncaughtException", async (err) => {
  cleanup();
  logError(err, {
    source: "dashboard",
    action: "error_handler",
    type: "uncaughtException",
  });
  await closeLogger();
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  cleanup();
  logError(new Error(String(reason)), {
    source: "dashboard",
    action: "error_handler",
    type: "unhandledRejection",
  });
  await closeLogger();
  process.exit(1);
});
