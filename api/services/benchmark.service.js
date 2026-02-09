import { BenchmarkHistory } from "../utils/benchmark-history.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

  /**
   * Parse benchmark result from command output
   * @param {string} output - Command stdout
   * @returns {Object|null} Parsed result or null
   */
  parseBenchmarkOutput(output) {
    try {
      // Look for BENCHMARK_RESULT: marker
      const match = output.match(/BENCHMARK_RESULT:(.+)/);
      if (!match) return null;

      const result = JSON.parse(match[1]);
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if benchmark output indicates an error
   * @param {string} output - Command stdout/stderr
   * @returns {{isError: boolean, message: string}}
   */
  checkBenchmarkError(output) {
    if (output.includes("not running") || output.includes("ECONNREFUSED")) {
      return {
        isError: true,
        message: "Framework not running. Start it first with PM2."
      };
    }

    if (output.includes("validation failed")) {
      return {
        isError: true,
        message: "Benchmark validation failed"
      };
    }

    return {
      isError: false,
      message: ""
    };
  }

  /**
   * Run benchmark remotely using bench.js
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark result
   */
  async runBenchmark(options) {
    const {
      framework,
      host = "localhost",
      endpoint = "/simple",
      method = "GET",
      duration = 20,
      connections,
      pipelining,
      workers,
      instances
    } = options;

    try {
      let cmd = `node bench.js -f ${framework} -H ${host} -e ${endpoint} -m ${method} -d ${duration}`;

      if (instances) {
        cmd += ` -i ${instances}`;
      }
      if (connections) {
        cmd += ` -c ${connections}`;
      }
      if (pipelining) {
        cmd += ` -p ${pipelining}`;
      }
      if (workers) {
        cmd += ` -w ${workers}`;
      }

      const { stdout, stderr } = await execAsync(cmd);
      const output = stdout + stderr;

      // Try to parse result
      const result = this.parseBenchmarkOutput(output);
      
      if (result) {
        await this.add(result);
      }

      return {
        success: true,
        result,
        output: output.substring(0, 500) // First 500 chars
      };
    } catch (error) {
      console.error("Benchmark execution error:", error);
      return {
        success: false,
        error: error.message,
        output: error.stdout?.substring(0, 500) || ""
      };
    }
  }
}
