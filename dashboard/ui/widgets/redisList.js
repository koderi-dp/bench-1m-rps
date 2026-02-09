import blessed from "blessed";
import { WIDGET_POSITIONS, COLORS } from "../../config/constants.js";
import { eventBus } from "../../services/events.service.js";

/**
 * Create Redis nodes list widget that subscribes to Redis stats
 * @param {Object} grid - Blessed contrib grid
 * @returns {Object} Redis list widget
 */
export function createRedisList(grid) {
  const pos = WIDGET_POSITIONS.redisList;
  
  const widget = grid.set(pos.row, pos.col, pos.rowSpan, pos.colSpan, blessed.list, {
    label: " Redis Nodes (0/0 online) ",
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    scrollbar: {
      ch: " ",
      style: {
        bg: "red"
      }
    },
    style: {
      fg: "white",
      selected: {
        bg: "blue",
        fg: "white"
      },
      border: {
        fg: "red"
      }
    },
    border: {
      type: "line"
    },
    tags: true
  });

  // Subscribe to Redis stats events
  const unsubscribe = eventBus.onRedisStats(({ stats, counts }) => {
    updateRedisList(widget, stats, counts);
  });

  // Store unsubscribe function for cleanup
  widget._eventUnsubscribe = unsubscribe;

  return widget;
}

/**
 * Update Redis list with new data
 * @param {Object} widget - Redis list widget
 * @param {Array<string>} items - Formatted Redis stats strings
 * @param {{online: number, total: number}} counts - Node counts
 */
export function updateRedisList(widget, items, counts) {
  // Update label with status
  if (counts.online === 0) {
    widget.setLabel(` {${COLORS.error}-fg}Redis Cluster (Not Running){/${COLORS.error}-fg} `);
  } else {
    const color = counts.online === counts.total ? COLORS.success : COLORS.warning;
    widget.setLabel(` {${color}-fg}Redis Cluster (${counts.online}/${counts.total} online){/${color}-fg} `);
  }
  
  // Set items
  widget.setItems(items);
  
  // Scroll to top if not focused
  if (!widget.focused) {
    widget.select(0);
  }
}

/**
 * Get Redis list state for debugging
 * @param {Object} widget - Redis list widget
 * @returns {Object} State object
 */
export function getRedisListState(widget) {
  return {
    items: widget.ritems,
    selected: widget.selected,
    focused: widget.focused
  };
}
