import blessed from "blessed";
import { WIDGET_POSITIONS, COLORS } from "../../config/constants.js";
import { eventBus } from "../../services/events.service.js";

/**
 * Create PM2 process list widget that subscribes to PM2 stats
 * @param {Object} grid - Blessed contrib grid
 * @returns {Object} PM2 list widget
 */
export function createPM2List(grid) {
  const pos = WIDGET_POSITIONS.pm2List;
  
  const widget = grid.set(pos.row, pos.col, pos.rowSpan, pos.colSpan, blessed.list, {
    label: " PM2 Processes (0/0 online) ",
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    scrollbar: {
      ch: " ",
      style: {
        bg: "cyan"
      }
    },
    style: {
      fg: "white",
      selected: {
        bg: "blue",
        fg: "white"
      },
      border: {
        fg: "cyan"
      }
    },
    border: {
      type: "line"
    },
    tags: true
  });

  // Subscribe to PM2 stats events
  const unsubscribe = eventBus.onPM2Stats(({ stats, counts }) => {
    updatePM2List(widget, stats, counts);
  });

  // Store unsubscribe function for cleanup
  widget._eventUnsubscribe = unsubscribe;

  return widget;
}

/**
 * Update PM2 list with new data
 * @param {Object} widget - PM2 list widget
 * @param {Array<string>} items - Formatted PM2 process strings
 * @param {{online: number, total: number}} counts - Process counts
 */
export function updatePM2List(widget, items, counts) {
  // Update label with counts
  const color = counts.online > 0 ? COLORS.success : COLORS.error;
  widget.setLabel(` {${color}-fg}PM2 Processes (${counts.online}/${counts.total} online){/${color}-fg} `);
  
  // Set items
  widget.setItems(items);
  
  // Scroll to top if not focused
  if (!widget.focused) {
    widget.select(0);
  }
}

/**
 * Get PM2 list state for debugging
 * @param {Object} widget - PM2 list widget
 * @returns {Object} State object
 */
export function getPM2ListState(widget) {
  return {
    items: widget.ritems,
    selected: widget.selected,
    focused: widget.focused
  };
}
