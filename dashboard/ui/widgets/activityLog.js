import blessed from "blessed";
import { WIDGET_POSITIONS, LIMITS } from "../../config/constants.js";
import { formatTime } from "../../utils/format.js";
import { subscribe } from "../../services/logger.service.js";

/**
 * Create activity log widget that subscribes to logger events
 * @param {Object} grid - Blessed contrib grid
 * @returns {Object} Activity log widget
 */
export function createActivityLog(grid) {
  const pos = WIDGET_POSITIONS.activityLog;
  
  const widget = grid.set(pos.row, pos.col, pos.rowSpan, pos.colSpan, blessed.log, {
    label: " Activity Log ",
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    scrollbar: {
      ch: " ",
      style: {
        bg: "green"
      }
    },
    border: {
      type: "line"
    },
    style: {
      fg: "white",
      border: {
        fg: "green"
      }
    }
  });

  // Subscribe to log events from logger service
  const unsubscribe = subscribe((level, message, context) => {
    // Only show logs that should be visible in the activity log
    // Skip internal system logs unless they're user-facing
    if (context.component === "activity_log") {
      // Avoid infinite loop - don't re-log activity log messages
      return;
    }

    // Determine if this log should be shown in activity UI
    const shouldShow = 
      context.source === "ui" ||
      context.source === "controller" ||
      context.action === "startup" ||
      context.action === "shutdown" ||
      level === "error" ||
      level === "warn";

    if (shouldShow) {
      addLogToWidget(widget, message, level);
    }
  });

  // Store unsubscribe function for cleanup
  widget._logUnsubscribe = unsubscribe;

  return widget;
}

/**
 * Add a log message to the widget (internal function)
 * @param {Object} widget - Activity log widget
 * @param {string} message - Log message
 * @param {string} level - Log level (info, debug, error, warn)
 */
function addLogToWidget(widget, message, level = "info") {
  const timestamp = formatTime();
  const colorMap = {
    info: "cyan",
    debug: "white",
    success: "green",
    warning: "yellow",
    warn: "yellow",
    error: "red"
  };
  
  const color = colorMap[level] || "white";
  const formattedMessage = `{gray-fg}[${timestamp}]{/gray-fg} {${color}-fg}${message}{/${color}-fg}`;
  
  widget.log(formattedMessage);
  
  // Limit log lines to prevent memory issues
  const lines = widget.logLines;
  if (lines && lines.length > LIMITS.maxLogLines) {
    widget.logLines = lines.slice(-LIMITS.maxLogLines);
  }
}

/**
 * Add a log message with timestamp (legacy function for manual logging)
 * @param {Object} widget - Activity log widget
 * @param {string} message - Log message
 * @param {string} level - Log level (info, success, warning, error)
 */
export function addLog(widget, message, level = "info") {
  addLogToWidget(widget, message, level);
}

/**
 * Clear all log messages
 * @param {Object} widget - Activity log widget
 */
export function clearLog(widget) {
  widget.setContent("");
  widget.logLines = [];
}

/**
 * Get log content for copy mode
 * @param {Object} widget - Activity log widget
 * @returns {string} Plain text log content
 */
export function getLogContent(widget) {
  if (!widget.logLines || widget.logLines.length === 0) {
    return "No log entries";
  }
  
  return widget.logLines.join("\n");
}

/**
 * Check if log widget is focused
 * @param {Object} widget - Activity log widget
 * @returns {boolean} True if focused
 */
export function isLogFocused(widget) {
  return widget.focused;
}
