/**
 * Global state management for dashboard overlays
 * Tracks which overlays are currently visible
 */

export const state = {
  menuOverlay: null,
  benchDetailsOverlay: null,
  selectionOverlay: null,
};

/**
 * Check if any blocking overlay is currently visible
 * @returns {boolean}
 */
export function hasBlockingOverlay() {
  return !!(state.selectionOverlay || state.benchDetailsOverlay || state.menuOverlay);
}

/**
 * Close the topmost overlay (if any)
 * @param {blessed.Screen} screen - The blessed screen instance
 * @param {Object} components - All overlay components with their close functions
 * @returns {boolean} True if an overlay was closed
 */
export function closeTopOverlay(screen, components) {
  // Close selection overlay first (highest priority)
  if (state.selectionOverlay) {
    const { closeSelectionOverlay } = components.selection;
    closeSelectionOverlay(state.selectionOverlay, screen);
    state.selectionOverlay = null;
    return true;
  }

  // Close benchmark details overlay
  if (state.benchDetailsOverlay) {
    const { hideBenchmarkDetails } = components.benchmark;
    hideBenchmarkDetails(state.benchDetailsOverlay, screen);
    state.benchDetailsOverlay = null;
    return true;
  }

  // Close menu overlay
  if (state.menuOverlay) {
    const { hideMenu } = components.menu;
    hideMenu(state.menuOverlay, screen);
    state.menuOverlay = null;
    return true;
  }

  return false;
}

/**
 * Set the menu overlay state
 * @param {Object} overlay - Menu overlay components
 */
export function setMenuOverlay(overlay) {
  state.menuOverlay = overlay;
}

/**
 * Set the benchmark details overlay state
 * @param {Object} overlay - Benchmark overlay components
 */
export function setBenchDetailsOverlay(overlay) {
  state.benchDetailsOverlay = overlay;
}

/**
 * Set the selection overlay state
 * @param {blessed.Box} overlay - Selection overlay
 */
export function setSelectionOverlay(overlay) {
  state.selectionOverlay = overlay;
}

/**
 * Clear all overlay state
 */
export function clearAllOverlays() {
  state.menuOverlay = null;
  state.benchDetailsOverlay = null;
  state.selectionOverlay = null;
}
