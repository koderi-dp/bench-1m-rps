/**
 * NavigationController - Manages panel focus and keyboard navigation
 */
export class NavigationController {
  constructor(screen, focusablePanels) {
    this.screen = screen;
    this.focusablePanels = focusablePanels;
    this.focusedPanelIndex = 0;
  }

  /**
   * Set the focused panel by index
   * @param {number} index - The panel index to focus
   */
  setFocusedPanel(index) {
    const total = this.focusablePanels.length;
    this.focusedPanelIndex = ((index % total) + total) % total;

    // Update border colors
    this.focusablePanels.forEach((panel, i) => {
      if (!panel.style) panel.style = {};
      if (!panel.style.border) panel.style.border = {};
      panel.style.border.fg = i === this.focusedPanelIndex ? "yellow" : "cyan";
    });

    // Focus the active panel
    const activePanel = this.focusablePanels[this.focusedPanelIndex];
    if (activePanel && typeof activePanel.focus === "function") {
      activePanel.focus();
    }

    this.screen.render();
  }

  /**
   * Move focus to the next panel (right arrow)
   */
  focusNext() {
    this.setFocusedPanel(this.focusedPanelIndex + 1);
  }

  /**
   * Move focus to the previous panel (left arrow)
   */
  focusPrevious() {
    this.setFocusedPanel(this.focusedPanelIndex - 1);
  }

  /**
   * Get the currently focused panel
   * @returns {Object} The focused panel widget
   */
  getCurrentPanel() {
    return this.focusablePanels[this.focusedPanelIndex];
  }

  /**
   * Get the current focus index
   * @returns {number}
   */
  getCurrentIndex() {
    return this.focusedPanelIndex;
  }

  /**
   * Check if a specific panel is currently focused
   * @param {Object} panel - The panel to check
   * @returns {boolean}
   */
  isPanelFocused(panel) {
    return this.focusablePanels[this.focusedPanelIndex] === panel;
  }
}
