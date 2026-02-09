import contrib from "blessed-contrib";
import { WIDGET_POSITIONS, CHART_STYLES, LIMITS } from "../../config/constants.js";
import { eventBus } from "../../services/events.service.js";
import { error as logError } from "../../services/logger.service.js";

/**
 * Create CPU line chart widget that subscribes to system stats
 * @param {Object} grid - Blessed contrib grid
 * @returns {Object} CPU chart widget
 */
export function createCPUChart(grid) {
  const pos = WIDGET_POSITIONS.cpuChart;
  
  const widget = grid.set(pos.row, pos.col, pos.rowSpan, pos.colSpan, contrib.line, {
    style: {
      line: CHART_STYLES.cpu.line,
      text: "white",
      baseline: "white"
    },
    xLabelPadding: 3,
    xPadding: 5,
    showLegend: false,
    wholeNumbersOnly: false,
    label: ` ${CHART_STYLES.cpu.title} `
  });

  // Subscribe to system stats events
  const unsubscribe = eventBus.onSystemStats((stats) => {
    try {
      if (stats.cpuData) {
        widget.setData(stats.cpuData);
      }
    } catch (err) {
      logError(err, {
        source: "ui",
        widget: "cpuChart",
        action: "update"
      });
    }
  });

  // Store unsubscribe function for cleanup
  widget._eventUnsubscribe = unsubscribe;

  return widget;
}

/**
 * Create Memory line chart widget that subscribes to system stats
 * @param {Object} grid - Blessed contrib grid
 * @returns {Object} Memory chart widget
 */
export function createMemoryChart(grid) {
  const pos = WIDGET_POSITIONS.memoryChart;
  
  const widget = grid.set(pos.row, pos.col, pos.rowSpan, pos.colSpan, contrib.line, {
    style: {
      line: CHART_STYLES.memory.line,
      text: "white",
      baseline: "white"
    },
    xLabelPadding: 3,
    xPadding: 5,
    showLegend: false,
    wholeNumbersOnly: false,
    label: ` ${CHART_STYLES.memory.title} `
  });

  // Subscribe to system stats events
  const unsubscribe = eventBus.onSystemStats((stats) => {
    try {
      if (stats.memoryData) {
        widget.setData(stats.memoryData);
      }
    } catch (err) {
      logError(err, {
        source: "ui",
        widget: "memoryChart",
        action: "update"
      });
    }
  });

  // Store unsubscribe function for cleanup
  widget._eventUnsubscribe = unsubscribe;

  return widget;
}

/**
 * Chart data manager
 */
export class ChartDataManager {
  constructor() {
    this.cpuData = {
      title: "CPU",
      x: [],
      y: [],
      style: { line: CHART_STYLES.cpu.line }
    };

    this.memData = {
      title: "Memory",
      x: [],
      y: [],
      style: { line: CHART_STYLES.memory.line }
    };

    this.dataPoints = 0;
  }

  /**
   * Add new data point to charts
   * @param {number} cpu - CPU usage percentage
   * @param {number} memory - Memory usage in MB
   */
  addDataPoint(cpu, memory) {
    this.dataPoints++;

    // Add new data
    this.cpuData.x.push(this.dataPoints.toString());
    this.cpuData.y.push(cpu);

    this.memData.x.push(this.dataPoints.toString());
    this.memData.y.push(memory);

    // Keep only last N data points (rolling window)
    if (this.cpuData.x.length > LIMITS.maxDataPoints) {
      this.cpuData.x.shift();
      this.cpuData.y.shift();
      this.memData.x.shift();
      this.memData.y.shift();
    }
  }

  /**
   * Get CPU chart data
   * @returns {Object} Chart data for blessed-contrib
   */
  getCPUData() {
    return [this.cpuData];
  }

  /**
   * Get memory chart data
   * @returns {Object} Chart data for blessed-contrib
   */
  getMemoryData() {
    return [this.memData];
  }

  /**
   * Reset all data
   */
  reset() {
    this.cpuData.x = [];
    this.cpuData.y = [];
    this.memData.x = [];
    this.memData.y = [];
    this.dataPoints = 0;
  }
}

/**
 * Update charts with new data
 * @param {Object} cpuChart - CPU chart widget
 * @param {Object} memChart - Memory chart widget
 * @param {ChartDataManager} dataManager - Data manager instance
 * @param {Object} stats - System stats {cpu, memory}
 */
export function updateCharts(cpuChart, memChart, dataManager, stats) {
  dataManager.addDataPoint(stats.cpu, stats.memory);
  
  cpuChart.setData(dataManager.getCPUData());
  memChart.setData(dataManager.getMemoryData());
}
