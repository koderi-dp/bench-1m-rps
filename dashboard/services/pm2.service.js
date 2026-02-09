import { execPM2Command } from "../utils/exec.js";
import { COLORS } from "../config/constants.js";

/**
 * PM2 Service
 * Handles all PM2 process management operations
 */
export class PM2Service {
  constructor(execFn = execPM2Command) {
    this.exec = execFn;
  }

  /**
   * Get PM2 process statistics
   * @returns {Promise<Array<string>>} Formatted process list with color tags
   */
  async getStats() {
    try {
      const { stdout } = await this.exec("pm2 jlist");
      return this.parseStats(stdout);
    } catch (error) {
      if (error.killed && error.signal === 'SIGTERM') {
        return ["PM2 timeout (too many processes?)"];
      }
      return [`Error loading PM2: ${error.message}`];
    }
  }

  /**
   * Parse PM2 JSON output into formatted strings
   * @param {string} output - Raw PM2 jlist output
   * @returns {Array<string>} Formatted strings
   */
  parseStats(output) {
    try {
      const processes = JSON.parse(output);
      
      if (!Array.isArray(processes) || processes.length === 0) {
        return ["{gray-fg}No PM2 processes running{/gray-fg}"];
      }

      return processes.map(proc => {
        const pid = proc.pid || "N/A";
        const name = (proc.name || "unknown").padEnd(12);
        const status = proc.pm2_env?.status || "unknown";
        const cpu = proc.monit?.cpu !== undefined ? `${proc.monit.cpu}%` : "0%";
        const mem = proc.monit?.memory !== undefined 
          ? `${Math.round(proc.monit.memory / 1024 / 1024)}MB` 
          : "0MB";

        const color = status === "online" ? COLORS.success : COLORS.error;
        const statusDisplay = status.padEnd(8);
        const cpuDisplay = cpu.padStart(6);
        const memDisplay = mem.padStart(8);

        return `{${color}-fg}${pid.toString().padStart(6)}  ${name}  ${statusDisplay}  ${cpuDisplay}  ${memDisplay}{/${color}-fg}`;
      });
    } catch (error) {
      return [`Error parsing PM2 data: ${error.message}`];
    }
  }

  /**
   * Count online processes
   * @param {Array<string>} stats - Formatted stats from getStats()
   * @returns {{online: number, total: number}}
   */
  countOnline(stats) {
    const onlineCount = stats.filter(s => s.includes("online")).length;
    return {
      online: onlineCount,
      total: stats.length
    };
  }

  /**
   * Start a framework with PM2
   * @param {string} framework - Framework name (cpeak, express, fastify)
   * @param {number} instances - Number of instances
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async start(framework, instances) {
    try {
      const { stdout } = await this.exec(`node pm2.js -start -f ${framework} -i ${instances}`);
      
      if (stdout.includes("started successfully") || stdout.includes("launched")) {
        const instanceCount = (stdout.match(/launched \d+ instances/i)?.[0]) || `${instances} instances`;
        return {
          success: true,
          message: `Started ${framework}: ${instanceCount}`
        };
      }

      return {
        success: false,
        message: `PM2 start: ${stdout.substring(0, 60)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Stop a framework
   * @param {string} framework - Framework name
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async stop(framework) {
    try {
      const { stdout } = await this.exec(`node pm2.js -stop -f ${framework}`);
      
      if (stdout.includes("stopped successfully")) {
        return {
          success: true,
          message: `Stopped ${framework}`
        };
      }

      return {
        success: false,
        message: `PM2 stop: ${stdout.substring(0, 60)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Restart a framework
   * @param {string} framework - Framework name
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async restart(framework) {
    try {
      const { stdout } = await this.exec(`pm2 restart ${framework}`);
      return {
        success: true,
        message: `Restarted ${framework}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Delete a framework
   * @param {string} framework - Framework name
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async delete(framework) {
    try {
      const { stdout } = await this.exec(`pm2 delete ${framework}`);
      return {
        success: true,
        message: `Deleted ${framework}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Delete all PM2 processes
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteAll() {
    try {
      await this.exec("pm2 delete all");
      return {
        success: true,
        message: "Deleted all PM2 processes"
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Show logs for a framework
   * @param {string} framework - Framework name
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async logs(framework) {
    return {
      success: true,
      message: `Opening logs: pm2 logs ${framework}`
    };
  }
}
