import contrib from "blessed-contrib";
import { WIDGET_POSITIONS, LIMITS } from "../../config/constants.js";
import { formatNumber } from "../../utils/format.js";
import { eventBus } from "../../services/events.service.js";

/**
 * Create benchmark summary table widget that subscribes to benchmark updates
 * @param {Object} grid - Blessed contrib grid
 * @returns {Object} Benchmark table widget
 */
export function createBenchmarkTable(grid) {
  const pos = WIDGET_POSITIONS.benchmarkTable;
  
  const widget = grid.set(pos.row, pos.col, pos.rowSpan, pos.colSpan, contrib.table, {
    keys: true,
    vi: true,
    fg: "white",
    selectedFg: "white",
    selectedBg: "blue",
    interactive: true,
    label: " Latest Benchmarks (Press 'b' for details) ",
    width: "100%",
    height: "100%",
    border: {
      type: "line",
      fg: "cyan"
    },
    columnSpacing: 2,
    columnWidth: [10, 10, 11, 10, 13]
  });

  // Subscribe to benchmark update events
  const unsubscribe = eventBus.onBenchmarkUpdate((results) => {
    updateBenchmarkTable(widget, results);
  });

  // Store unsubscribe function for cleanup
  widget._eventUnsubscribe = unsubscribe;

  return widget;
}

/**
 * Format benchmark results for table display
 * @param {Array} results - Benchmark results
 * @returns {{headers: Array, data: Array}} Table data
 */
export function formatBenchmarkTableData(results) {
  const headers = ["Time", "Framework", "Req/s", "Avg Lat", "Total Reqs"];
  
  if (!results || results.length === 0) {
    return {
      headers,
      data: [["", "No data", "", "", ""]]
    };
  }

  const data = results.slice(0, LIMITS.maxBenchmarkResults).map(r => {
    const time = new Date(r.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    return [
      time,
      r.framework,
      formatNumber(r.reqPerSec),
      `${r.avgLatency}ms`,
      formatNumber(r.totalReqs)
    ];
  });

  return { headers, data };
}

/**
 * Update benchmark table with new data
 * @param {Object} widget - Benchmark table widget
 * @param {Array} results - Benchmark results
 */
export function updateBenchmarkTable(widget, results) {
  const { headers, data } = formatBenchmarkTableData(results);
  widget.setData({ headers, data });
}
