/**
 * Dashboard Configuration Constants
 */

import { getColorMapping, isConfigInitialized } from "./frameworksConfig.js";

// Base colors (always available)
const BASE_COLORS = {
  success: "green",
  warning: "yellow",
  error: "red",
  info: "cyan",
  neutral: "white",
  disabled: "gray"
};

/**
 * Get colors including framework colors (call after config is initialized)
 * @returns {Object} Color mapping
 */
export function getColors() {
  if (isConfigInitialized()) {
    return {
      ...getColorMapping(),
      ...BASE_COLORS
    };
  }
  return BASE_COLORS;
}

// Export static COLORS for backward compatibility (without framework colors initially)
export const COLORS = BASE_COLORS;

export const GRID_LAYOUT = {
  rows: 12,
  cols: 12
};

export const WIDGET_POSITIONS = {
  title: { row: 0, col: 0, rowSpan: 1, colSpan: 12 },
  cpuChart: { row: 1, col: 0, rowSpan: 3, colSpan: 6 },
  memoryChart: { row: 1, col: 6, rowSpan: 3, colSpan: 6 },
  pm2List: { row: 4, col: 0, rowSpan: 5, colSpan: 6 },
  redisList: { row: 4, col: 6, rowSpan: 3, colSpan: 6 },
  benchmarkTable: { row: 7, col: 6, rowSpan: 2, colSpan: 6 },
  systemInfo: { row: 9, col: 0, rowSpan: 3, colSpan: 6 },
  activityLog: { row: 9, col: 6, rowSpan: 3, colSpan: 6 }
};

export const TIMEOUTS = {
  command: 30000,        // 30 seconds for shell commands
  pm2Stats: 5000,        // 5 seconds for PM2 jlist
  redisStats: 2000,      // 2 seconds per Redis node
  updateInterval: 2000,  // 2 seconds between dashboard updates (legacy mode)
  fastInterval: 1000,    // 1 second for volatile data (fast lane)
  slowInterval: 5000,    // 5 seconds for stable data (slow lane)
  refreshDelay: 1000     // 1 second delay after command execution
};

export const PERFORMANCE = {
  useVariableIntervals: true,  // Enable fast/slow lane system (Phase 2 optimization)
  redisCacheTTL: 5000,         // 5 seconds for Redis master port cache
  systemCacheEnabled: true     // Enable system data caching
};

export const BUFFERS = {
  pm2Output: 10 * 1024 * 1024,  // 10MB for PM2 output
  commandOutput: 5 * 1024 * 1024 // 5MB for general commands
};

export const LIMITS = {
  maxDataPoints: 30,     // Chart data points
  maxLogLines: 100,      // Activity log lines
  maxBenchmarkResults: 3, // Benchmark summary table
  maxPM2Instances: 100,  // Hard limit for PM2 instances
  warnPM2Instances: 50,  // Warning threshold
  minRedisNodes: 3       // Minimum Redis cluster nodes
};

export const CHART_STYLES = {
  cpu: {
    line: "yellow",
    title: "CPU Usage (%)"
  },
  memory: {
    line: "cyan",
    title: "Memory Usage (MB)"
  }
};

export const SPARKLINE_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export const KEYBOARD = {
  exit: ['q', 'C-c'],
  escape: ['escape'],
  refresh: ['r'],
  menu: ['m'],
  benchmark: ['b', 'B'],
  copy: ['s', 'c'],
  left: ['left'],
  right: ['right'],
  up: ['up'],
  down: ['down'],
  enter: ['enter'],
  yes: ['y', 'Y']
};
