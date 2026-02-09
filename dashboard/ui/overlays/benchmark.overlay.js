import blessed from "blessed";
import contrib from "blessed-contrib";
import { formatNumber } from "../../utils/format.js";

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

  // Bar Chart (top 25%)
  const barChart = blessed.box({
    parent: overlay,
    top: 0,
    left: 1,
    width: "100%-2",
    height: "25%-1",
    border: {
      type: "line",
    },
    style: {
      border: {
        fg: "green",
      },
    },
    label: " Latest Performance by Endpoint ",
    content: "",
    tags: true,
  });

  // History Table (middle 50%)
  const historyTable = contrib.table({
    parent: overlay,
    top: "25%",
    left: 1,
    width: "100%-2",
    height: "50%-1",
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

  // Details Panel (bottom 25%)
  const detailsPanel = blessed.box({
    parent: overlay,
    top: "75%",
    left: 1,
    width: "100%-2",
    height: "25%-1",
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
    barChart,
    historyTable,
    detailsPanel,
  };
}

/**
 * Generate bar chart content from benchmark results
 * @param {Object} latestByFramework - Map of framework:endpoint:method -> result
 * @returns {string} Formatted bar chart content with tags
 */
function generateBarChartContent(latestByFramework) {
  const frameworks = ["cpeak", "express", "fastify"];
  const colors = { cpeak: "green", express: "blue", fastify: "magenta" };

  // Group results by framework
  const grouped = {};
  for (const key in latestByFramework) {
    const result = latestByFramework[key];
    const framework = result.framework;
    if (!grouped[framework]) {
      grouped[framework] = [];
    }
    grouped[framework].push(result);
  }

  // Sort results within each framework by reqPerSec descending
  for (const framework in grouped) {
    grouped[framework].sort((a, b) => b.reqPerSec - a.reqPerSec);
  }

  // Collect all unique endpoints
  const allEndpoints = new Set();
  for (const framework of frameworks) {
    const results = grouped[framework] || [];
    for (const result of results) {
      allEndpoints.add(`${result.method} ${result.endpoint}`);
    }
  }
  const endpoints = Array.from(allEndpoints).sort();

  if (endpoints.length === 0) {
    return "\n  {gray-fg}No benchmark data available{/gray-fg}\n";
  }

  // Header row with framework names
  const colWidth = 20;
  const labelWidth = 18;
  let content = "\n  " + "Endpoint".padEnd(labelWidth);
  content += "{green-fg}" + "CPEAK".padEnd(colWidth) + "{/green-fg}";
  content += "{blue-fg}" + "EXPRESS".padEnd(colWidth) + "{/blue-fg}";
  content += "{magenta-fg}" + "FASTIFY".padEnd(colWidth) + "{/magenta-fg}";
  content += "\n  " + "─".repeat(labelWidth + colWidth * 3) + "\n";

  // Find max value for scaling
  const allValues = [];
  for (const framework of frameworks) {
    const results = grouped[framework] || [];
    for (const result of results) {
      allValues.push(result.reqPerSec);
    }
  }
  const maxValue = Math.max(...allValues, 1);

  // Display each endpoint as a row
  for (const endpoint of endpoints) {
    let row = "  " + endpoint.padEnd(labelWidth);

    for (const framework of frameworks) {
      const results = grouped[framework] || [];
      const result = results.find((r) => `${r.method} ${r.endpoint}` === endpoint);
      const color = colors[framework];

      if (result) {
        const value = result.reqPerSec;
        const barLength = Math.max(1, Math.floor((value / maxValue) * 8));
        const bar = "█".repeat(barLength);
        const valueStr = formatNumber(value);
        row += `{${color}-fg}${bar.padEnd(9)}${valueStr.padEnd(11)}{/${color}-fg}`;
      } else {
        row += `{gray-fg}${"─".padEnd(colWidth)}{/gray-fg}`;
      }
    }

    content += row + "\n";
  }

  return content;
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
      time,
      r.framework,
      formatNumber(r.reqPerSec),
      `${r.avgLatency}ms`,
      `${r.p50Latency}ms`,
      `${r.p90Latency}ms`,
      `${r.p99Latency}ms`,
      formatNumber(r.totalReqs),
      r.endpoint,
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

  const hasErrors = result.errors > 0 || result.timeouts > 0 || result.non2xx > 0;
  const errorColor = hasErrors ? "yellow" : "green";

  return `
  {cyan-fg}Framework:{/cyan-fg} ${result.framework}  |  {cyan-fg}Endpoint:{/cyan-fg} ${result.method} ${result.endpoint}
  {cyan-fg}Timestamp:{/cyan-fg} ${new Date(result.timestamp).toLocaleString()}
  ─────────────────────────────────────────────────────────────────────────────
  {yellow-fg}Configuration:{/yellow-fg}
    Duration: ${result.duration}s  |  Connections: ${result.connections}  |  Workers: ${result.workers}  |  Pipelining: ${result.pipelining}
  ─────────────────────────────────────────────────────────────────────────────
  {yellow-fg}Latency:{/yellow-fg}
    Average: ${result.avgLatency} ms  |  P50: ${result.p50Latency} ms  |  P90: ${result.p90Latency} ms  |  P99: ${result.p99Latency} ms
  ─────────────────────────────────────────────────────────────────────────────
  {yellow-fg}Requests:{/yellow-fg}
    Total: ${formatNumber(result.totalReqs)}  |  Per Second: ${formatNumber(result.reqPerSec)}
  ─────────────────────────────────────────────────────────────────────────────
  {${errorColor}-fg}Status:{/${errorColor}-fg}
    Errors: ${result.errors}  |  Timeouts: ${result.timeouts}  |  Non-2xx: ${result.non2xx}
    `;
}

/**
 * Show the benchmark details overlay with data
 * @param {Object} components - { overlay, barChart, historyTable, detailsPanel }
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {BenchmarkService} benchmarkService - The benchmark service instance
 * @param {Function} onClear - Callback when clear is requested
 */
export async function showBenchmarkDetails(components, screen, benchmarkService, onClear) {
  const { overlay, barChart, historyTable, detailsPanel } = components;

  // Get all benchmark history
  const allResults = await benchmarkService.getAll();

  if (allResults.length === 0) {
    return null; // Signal to caller that there's no data
  }

  // Update bar chart
  const latestByFramework = await benchmarkService.getLatestByFramework();
  const barContent = generateBarChartContent(latestByFramework);
  barChart.setContent(barContent);

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

  overlay.show();
  historyTable.focus();
  screen.render();

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
