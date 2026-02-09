import blessed from "blessed";
import { WIDGET_POSITIONS, COLORS } from "../../config/constants.js";
import { eventBus } from "../../services/events.service.js";

/**
 * Create system info box widget that subscribes to system stats
 * @param {Object} grid - Blessed contrib grid
 * @returns {Object} System info widget
 */
export function createSystemInfo(grid) {
  const pos = WIDGET_POSITIONS.systemInfo;
  
  const widget = grid.set(pos.row, pos.col, pos.rowSpan, pos.colSpan, blessed.box, {
    label: " System Info ",
    content: "",
    tags: true,
    border: {
      type: "line"
    },
    style: {
      fg: "white",
      border: {
        fg: "yellow"
      }
    }
  });

  // Subscribe to system stats events
  const unsubscribe = eventBus.onSystemStats((stats) => {
    if (stats.codeCount !== undefined) {
      updateSystemInfo(widget, stats, stats.codeCount);
    }
  });

  // Store unsubscribe function for cleanup
  widget._eventUnsubscribe = unsubscribe;

  return widget;
}

/**
 * Format system info content
 * @param {Object} stats - System stats object
 * @param {number} codeCount - Redis code count
 * @returns {string} Formatted content with color tags
 */
export function formatSystemInfo(stats, codeCount) {
  const cpuPercent = stats.cpu.toFixed(1);
  const memPercent = ((stats.memory / stats.totalMemory) * 100).toFixed(1);
  
  // Color based on usage
  const cpuColor = stats.cpu > 80 ? COLORS.error : stats.cpu > 60 ? COLORS.warning : COLORS.success;
  const memColor = memPercent > 80 ? COLORS.error : memPercent > 60 ? COLORS.warning : COLORS.success;
  
  return `
  {cyan-fg}Uptime:{/cyan-fg} ${stats.uptime}
  {cyan-fg}Load Avg:{/cyan-fg} ${stats.loadAvg}
  {cyan-fg}Memory:{/cyan-fg} ${stats.memory.toFixed(0)} MB / ${stats.totalMemory} MB
  
  {cyan-fg}CPU Usage:{/cyan-fg} {${cpuColor}-fg}${cpuPercent}%{/${cpuColor}-fg}
  {cyan-fg}Memory Usage:{/cyan-fg} {${memColor}-fg}${memPercent}%{/${memColor}-fg}
  
  {cyan-fg}Codes in Redis:{/cyan-fg} {green-fg}${codeCount.toLocaleString()}{/green-fg}
  `;
}

/**
 * Update system info widget
 * @param {Object} widget - System info widget
 * @param {Object} stats - System stats
 * @param {number} codeCount - Redis code count
 */
export function updateSystemInfo(widget, stats, codeCount) {
  const content = formatSystemInfo(stats, codeCount);
  widget.setContent(content);
}
