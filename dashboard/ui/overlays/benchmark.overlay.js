import blessed from "blessed";
import contrib from "blessed-contrib";
import { formatNumber } from "../../utils/format.js";
import { getFrameworkNames } from "../../config/frameworksConfig.js";

/**
 * Create the benchmark history overlay (hidden by default)
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {BenchmarkService} benchmarkService - The benchmark service instance
 * @returns {Object} Overlay components
 */
export function createBenchmarkOverlay(screen, benchmarkService) {
  const overlay = blessed.box({
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
      fg: "white",
      border: {
        fg: "cyan",
      },
    },
    label: " Benchmark History - Press ESC to close, ↑↓ to scroll, 'c' to clear history ",
    hidden: true,
  });

  // Summary Table (top 30%)
  const summaryTable = contrib.table({
    parent: overlay,
    top: 0,
    left: 1,
    width: "100%-2",
    height: "30%-1",
    keys: false,
    vi: false,
    interactive: false,
    border: {
      type: "line",
    },
    style: {
      border: {
        fg: "green",
      },
      header: {
        fg: "yellow",
        bold: true,
      },
    },
    label: " Latest Performance by Endpoint (Req/s) ",
    columnSpacing: 3,
    columnWidth: [18, 10, 12, 12, 12],
  });

  // History Table (middle 40%)
  const historyTable = contrib.table({
    parent: overlay,
    top: "30%",
    left: 1,
    width: "100%-2",
    height: "40%-1",
    keys: true,
    vi: true,
    interactive: true,
    selectedFg: "white",
    selectedBg: "blue",
    border: {
      type: "line",
    },
    style: {
      border: {
        fg: "cyan",
      },
      header: {
        fg: "yellow",
        bold: true,
      },
    },
    label: " Full History (↑↓ to navigate) ",
    columnSpacing: 2,
    columnWidth: [10, 10, 11, 9, 9, 9, 11, 15, 10],
  });

  // Details Panel (bottom 30%)
  const detailsPanel = blessed.box({
    parent: overlay,
    top: "70%",
    left: 1,
    width: "100%-2",
    height: "30%-1",
    border: {
      type: "line",
    },
    style: {
      border: {
        fg: "magenta",
      },
    },
    label: " Selected Benchmark Details ",
    content: "",
    tags: true,
    scrollable: true,
  });

  return {
    overlay,
    summaryTable,
    historyTable,
    detailsPanel,
  };
}

/**
 * Format summary table data - shows latest performance by endpoint across frameworks
 * @param {Object} latestByFramework - Map of framework:endpoint:method -> result
 * @returns {Object} { headers, data }
 */
function formatSummaryTableData(latestByFramework) {
  const frameworkList = getFrameworkNames();
  const headers = ["Endpoint", "Method", ...frameworkList];
  
  if (!latestByFramework || Object.keys(latestByFramework).length === 0) {
    return {
      headers,
      data: [["No data", "—", ...frameworkList.map(() => "—")]]
    };
  }

  // Group by endpoint+method
  const endpointMap = new Map();
  
  for (const key in latestByFramework) {
    const result = latestByFramework[key];
    const endpoint = result.endpoint || '/';
    const method = result.method || 'GET';
    const framework = result.framework || 'unknown';
    const endpointKey = `${endpoint}:${method}`;
    
    if (!endpointMap.has(endpointKey)) {
      endpointMap.set(endpointKey, {
        endpoint,
        method,
        frameworks: {}
      });
    }
    
    endpointMap.get(endpointKey).frameworks[framework] = result.reqPerSec;
  }
  
  const data = Array.from(endpointMap.values()).map(item => {
    const row = [
      item.endpoint,
      item.method,
    ];
    
    // Add framework data in order
    frameworkList.forEach(framework => {
      const value = item.frameworks[framework];
      row.push(value ? formatNumber(value) : "—");
    });
    
    return row;
  });

  return { headers, data };
}

/**
 * Format history table data
 * @param {Array} allResults - All benchmark results
 * @returns {Object} { headers, data }
 */
function formatHistoryTableData(allResults) {
  const headers = ["Time", "Framework", "Req/s", "Avg Lat", "P50", "P90", "P99", "Total Reqs", "Endpoint"];
  const data = allResults.map((r) => {
    const time = new Date(r.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return [
      time || "N/A",
      r.framework || "N/A",
      formatNumber(r.reqPerSec) || "0",
      r.avgLatency != null ? `${r.avgLatency}ms` : "N/A",
      r.p50Latency != null ? `${r.p50Latency}ms` : "N/A",
      r.p90Latency != null ? `${r.p90Latency}ms` : "N/A",
      r.p99Latency != null ? `${r.p99Latency}ms` : "N/A",
      formatNumber(r.totalReqs) || "0",
      r.endpoint || "/",
    ];
  });

  return { headers, data };
}

/**
 * Format details panel content
 * @param {Object} result - Single benchmark result
 * @returns {string} Formatted details content with tags
 */
function formatDetailsContent(result) {
  if (!result) return "";

  const hasErrors = (result.errors || 0) > 0 || (result.timeouts || 0) > 0 || (result.non2xx || 0) > 0;
  const errorColor = hasErrors ? "yellow" : "green";

  return `
  {cyan-fg}Framework:{/cyan-fg} ${result.framework || "N/A"}  |  {cyan-fg}Endpoint:{/cyan-fg} ${result.method || "GET"} ${result.endpoint || "/"}
  {cyan-fg}Timestamp:{/cyan-fg} ${new Date(result.timestamp).toLocaleString()}
  ─────────────────────────────────────────────────────────────────────────────
  {yellow-fg}Configuration:{/yellow-fg}
    Duration: ${result.duration || "N/A"}s  |  Connections: ${result.connections || "N/A"}  |  Workers: ${result.workers || "N/A"}  |  Pipelining: ${result.pipelining || "N/A"}
  ─────────────────────────────────────────────────────────────────────────────
  {yellow-fg}Latency:{/yellow-fg}
    Average: ${result.avgLatency != null ? result.avgLatency : "N/A"} ms  |  P50: ${result.p50Latency != null ? result.p50Latency : "N/A"} ms  |  P90: ${result.p90Latency != null ? result.p90Latency : "N/A"} ms  |  P99: ${result.p99Latency != null ? result.p99Latency : "N/A"} ms
  ─────────────────────────────────────────────────────────────────────────────
  {yellow-fg}Requests:{/yellow-fg}
    Total: ${formatNumber(result.totalReqs) || "0"}  |  Per Second: ${formatNumber(result.reqPerSec) || "0"}
  ─────────────────────────────────────────────────────────────────────────────
  {${errorColor}-fg}Status:{/${errorColor}-fg}
    Errors: ${result.errors || 0}  |  Timeouts: ${result.timeouts || 0}  |  Non-2xx: ${result.non2xx || 0}
    `;
}

/**
 * Show the benchmark details overlay with data
 * @param {Object} components - { overlay, summaryTable, historyTable, detailsPanel }
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {BenchmarkService} benchmarkService - The benchmark service instance
 * @param {Function} onClear - Callback when clear is requested
 */
export async function showBenchmarkDetails(components, screen, benchmarkService, onClear) {
  const { overlay, summaryTable, historyTable, detailsPanel } = components;

  // Get all benchmark history
  const allResults = await benchmarkService.getAll();

  if (allResults.length === 0) {
    return null; // Signal to caller that there's no data
  }

  // Show overlay first
  overlay.show();
  historyTable.focus();
  screen.render();

  // Update summary table
  const latestByFramework = await benchmarkService.getLatestByFramework();
  const summaryData = formatSummaryTableData(latestByFramework);
  summaryTable.setData(summaryData);

  // Update history table
  const { headers, data } = formatHistoryTableData(allResults);
  historyTable.setData({ headers, data });

  // Function to update details panel
  const updateDetailsPanel = (index) => {
    const result = allResults[index];
    const content = formatDetailsContent(result);
    detailsPanel.setContent(content);
    screen.render();
  };

  // Show first result details
  updateDetailsPanel(0);

  // Handle table row selection (remove old listeners first)
  historyTable.rows.removeAllListeners("select");
  let selectedIndex = 0;
  historyTable.rows.on("select", (item, index) => {
    selectedIndex = index;
    updateDetailsPanel(index);
  });

  // Key bindings (remove old listeners first)
  overlay.removeAllListeners("keypress");

  overlay.key(["escape", "q"], () => {
    hideBenchmarkDetails(components, screen);
  });

  overlay.key(["c"], async () => {
    // Show confirmation dialog
    const confirmBox = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: 50,
      height: 7,
      border: { type: "line" },
      style: {
        bg: "black",
        border: { fg: "red" },
      },
      label: " Confirm Clear History ",
      content: "\n  Are you sure you want to clear all history?\n\n  Press 'y' to confirm, any other key to cancel",
      tags: true,
    });

    confirmBox.key(["y", "Y"], async () => {
      screen.remove(confirmBox);
      hideBenchmarkDetails(components, screen);
      await onClear(); // Call the clear callback
      screen.render();
    });

    confirmBox.key(["n", "N", "escape"], () => {
      screen.remove(confirmBox);
      overlay.focus();
      screen.render();
    });

    screen.append(confirmBox);
    confirmBox.focus();
    screen.render();
  });

  return true; // Success
}

/**
 * Hide the benchmark details overlay
 * @param {Object} components - { overlay }
 * @param {blessed.Screen} screen - The blessed screen instance
 */
export function hideBenchmarkDetails(components, screen) {
  const { overlay } = components;
  overlay.hide();
  screen.render();
}

/**
 * Check if overlay is visible
 * @param {Object} components - { overlay }
 * @returns {boolean}
 */
export function isBenchmarkDetailsVisible(components) {
  const { overlay } = components;
  return overlay && !overlay.hidden;
}
