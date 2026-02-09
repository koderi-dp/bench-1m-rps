import { execCommand } from "../utils/exec.js";

/**
 * System Service
 * Handles system statistics (CPU, memory, uptime, load)
 */
export class SystemService {
  constructor(execFn = execCommand) {
    this.exec = execFn;
  }

  /**
   * Get all system statistics
   * @returns {Promise<{cpu: number, memory: number, totalMemory: number, uptime: string, loadAvg: string}>}
   */
  async getStats() {
    try {
      const [cpu, memory, totalMemory, uptime, loadAvg] = await Promise.all([
        this.getCPU(),
        this.getMemory(),
        this.getTotalMemory(),
        this.getUptime(),
        this.getLoadAverage()
      ]);

      return {
        cpu: parseFloat(cpu) || 0,
        memory: parseFloat(memory) || 0,
        totalMemory: parseInt(totalMemory, 10) || 0,
        uptime: uptime || "Unknown",
        loadAvg: loadAvg || "0.00 0.00 0.00"
      };
    } catch (error) {
      return {
        cpu: 0,
        memory: 0,
        totalMemory: 0,
        uptime: "Unknown",
        loadAvg: "0.00 0.00 0.00"
      };
    }
  }

  /**
   * Get CPU usage percentage
   * @returns {Promise<string>} CPU usage as string (e.g., "45.2")
   */
  async getCPU() {
    try {
      const command = "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'";
      const { stdout } = await this.exec(command);
      return stdout.trim();
    } catch (error) {
      return "0";
    }
  }

  /**
   * Get memory usage in MB
   * @returns {Promise<string>} Memory usage as string
   */
  async getMemory() {
    try {
      const { stdout } = await this.exec("free -m | awk 'NR==2{printf \"%.2f\", $3}'");
      return stdout.trim();
    } catch (error) {
      return "0";
    }
  }

  /**
   * Get total memory in MB
   * @returns {Promise<string>} Total memory as string
   */
  async getTotalMemory() {
    try {
      const { stdout } = await this.exec("free -m | awk 'NR==2{printf \"%s\", $2}'");
      return stdout.trim();
    } catch (error) {
      return "0";
    }
  }

  /**
   * Get system uptime
   * @returns {Promise<string>} Uptime string (e.g., "up 2 hours, 30 minutes")
   */
  async getUptime() {
    try {
      const { stdout } = await this.exec("uptime -p");
      return stdout.trim().replace(/^up /, "");
    } catch (error) {
      return "Unknown";
    }
  }

  /**
   * Get load average (1, 5, 15 minutes)
   * @returns {Promise<string>} Load average string (e.g., "1.23 0.98 0.76")
   */
  async getLoadAverage() {
    try {
      const { stdout } = await this.exec("cat /proc/loadavg | awk '{print $1, $2, $3}'");
      return stdout.trim();
    } catch (error) {
      return "0.00 0.00 0.00";
    }
  }

  /**
   * Get number of CPU cores
   * @returns {Promise<number>} Number of cores
   */
  async getCPUCores() {
    try {
      const { stdout } = await this.exec("nproc");
      return parseInt(stdout.trim(), 10) || 1;
    } catch (error) {
      return 1;
    }
  }

  /**
   * Get disk usage for current directory
   * @returns {Promise<{used: string, available: string, percentage: string}>}
   */
  async getDiskUsage() {
    try {
      const { stdout } = await this.exec("df -h . | awk 'NR==2{print $3, $4, $5}'");
      const [used, available, percentage] = stdout.trim().split(' ');
      
      return {
        used: used || "0",
        available: available || "0",
        percentage: percentage || "0%"
      };
    } catch (error) {
      return {
        used: "0",
        available: "0",
        percentage: "0%"
      };
    }
  }

  /**
   * Get Node.js version
   * @returns {Promise<string>} Node version (e.g., "v18.17.0")
   */
  async getNodeVersion() {
    try {
      const { stdout } = await this.exec("node --version");
      return stdout.trim();
    } catch (error) {
      return "Unknown";
    }
  }
}
