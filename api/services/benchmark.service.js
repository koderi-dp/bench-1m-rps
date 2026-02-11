import { BenchmarkHistory } from "../utils/benchmark-history.js";

/**
 * Benchmark Service
 * Wrapper for BenchmarkHistory module with additional utilities
 */
export class BenchmarkService {
  constructor(historyModule = BenchmarkHistory) {
    this.history = historyModule;
  }

  /**
   * Get latest N benchmark results
   * @param {number} count - Number of results to retrieve
   * @returns {Promise<Array>} Benchmark results
   */
  async getLatest(count = 10) {
    return await this.history.getLatest(count);
  }

  /**
   * Force reload benchmark history from disk
   * Use this when file was modified by another process (e.g., bench.js)
   * @returns {Promise<Object>} Reloaded history data
   */
  async reload() {
    return await this.history.reload();
  }

  /**
   * Get all benchmark results
   * @returns {Promise<Array>} All benchmark results
   */
  async getAll() {
    return await this.history.getAll();
  }

  /**
   * Get latest result for each framework+endpoint combination
   * @returns {Promise<Object>} Map of "framework:endpoint:method" to result
   */
  async getLatestByFramework() {
    return await this.history.getLatestByFramework();
  }

  /**
   * Get results for a specific framework
   * @param {string} framework - Framework name
   * @returns {Promise<Array>} Filtered results
   */
  async getByFramework(framework) {
    return await this.history.getByFramework(framework);
  }

  /**
   * Add a new benchmark result
   * @param {Object} result - Benchmark result object
   * @returns {Promise<boolean>} Success status
   */
  async add(result) {
    return await this.history.add(result);
  }

  /**
   * Clear all benchmark history
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    return await this.history.clear();
  }

  /**
   * Get statistics summary
   * @returns {Promise<Object>} Statistics by framework
   */
  async getStats() {
    return await this.history.getStats();
  }

  /**
   * Format benchmark result for display
   * @param {Object} result - Raw benchmark result
   * @returns {Object} Formatted result
   */
  formatResult(result) {
    return {
      time: new Date(result.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }),
      framework: result.framework,
      endpoint: `${result.method} ${result.endpoint}`,
      reqPerSec: result.reqPerSec.toLocaleString(),
      avgLatency: `${result.avgLatency}ms`,
      totalReqs: result.totalReqs.toLocaleString(),
      errors: result.errors || 0,
      hasErrors: (result.errors + result.timeouts + result.non2xx) > 0
    };
  }

}
