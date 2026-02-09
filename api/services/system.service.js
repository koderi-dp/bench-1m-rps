import { execCommand } from "../utils/exec.js";
import { readFile } from "fs/promises";

/**
 * System Service
 * Handles system statistics (CPU, memory, uptime, load)
 */
export class SystemService {
  constructor(execFn = execCommand) {
    this.exec = execFn;
    
    // Cache for stable data that rarely changes
    this.cache = {
      totalMemory: null,
      cpuCores: null,
      nodeVersion: null,
      lastCpuStats: null,
      lastCpuTime: 0
    };
  }

  /**
   * Get all system statistics (optimized - single read operation)
   * @returns {Promise<{cpu: number, memory: number, totalMemory: number, uptime: string, loadAvg: string}>}
   */
  async getStats() {
    try {
      // Use native /proc reads for most stats (no shell commands)
      const [cpu, memoryData, loadAvgData, uptimeData, totalMemory] = await Promise.all([
        this.getCPU(),
        readFile('/proc/meminfo', 'utf8').catch(() => null),
        readFile('/proc/loadavg', 'utf8').catch(() => null),
        readFile('/proc/uptime', 'utf8').catch(() => null),
        this.getTotalMemory() // Uses cache after first call
      ]);

      // Parse memory
      let memory = 0;
      if (memoryData) {
        const totalMatch = memoryData.match(/MemTotal:\s+(\d+)\s+kB/);
        const availMatch = memoryData.match(/MemAvailable:\s+(\d+)\s+kB/);
        if (totalMatch && availMatch) {
          const total = parseInt(totalMatch[1], 10) / 1024; // Convert to MB
          const available = parseInt(availMatch[1], 10) / 1024;
          memory = total - available;
        }
      }

      // Parse load average
      let loadAvg = "0.00 0.00 0.00";
      if (loadAvgData) {
        const parts = loadAvgData.trim().split(' ');
        loadAvg = `${parts[0] || '0.00'} ${parts[1] || '0.00'} ${parts[2] || '0.00'}`;
      }

      // Parse uptime
      let uptime = "Unknown";
      if (uptimeData) {
        const uptimeSeconds = parseFloat(uptimeData.split(' ')[0]);
        uptime = this.formatUptime(uptimeSeconds);
      }

      return {
        cpu: parseFloat(cpu) || 0,
        memory: Math.round(memory * 100) / 100 || 0,
        totalMemory: parseInt(totalMemory, 10) || 0,
        uptime: uptime,
        loadAvg: loadAvg
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
   * Format uptime seconds into human-readable string
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    
    return parts.length > 0 ? parts.join(', ') : 'less than a minute';
  }

  /**
   * Get CPU usage percentage (optimized using /proc/stat)
   * @returns {Promise<string>} CPU usage as string (e.g., "45.2")
   */
  async getCPU() {
    try {
      const statData = await readFile('/proc/stat', 'utf8');
      const cpuLine = statData.split('\n')[0]; // First line is aggregate CPU
      const values = cpuLine.split(/\s+/).slice(1).map(v => parseInt(v, 10));
      
      // Calculate total and idle time
      const idle = values[3];
      const total = values.reduce((acc, val) => acc + val, 0);

      // Calculate CPU usage since last measurement
      if (this.cache.lastCpuStats) {
        const idleDelta = idle - this.cache.lastCpuStats.idle;
        const totalDelta = total - this.cache.lastCpuStats.total;
        
        if (totalDelta > 0) {
          const usage = 100 * (1 - idleDelta / totalDelta);
          this.cache.lastCpuStats = { idle, total };
          return usage.toFixed(1);
        }
      }
      
      // First measurement - store and return 0
      this.cache.lastCpuStats = { idle, total };
      return "0.0";
    } catch (error) {
      // Fallback to shell command if /proc/stat fails
      try {
        const command = "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'";
        const { stdout } = await this.exec(command);
        return stdout.trim();
      } catch (fallbackError) {
        return "0";
      }
    }
  }

  /**
   * Get memory usage in MB (kept for backward compatibility but not used in getStats)
   * @returns {Promise<string>} Memory usage as string
   */
  async getMemory() {
    try {
      const memData = await readFile('/proc/meminfo', 'utf8');
      const totalMatch = memData.match(/MemTotal:\s+(\d+)\s+kB/);
      const availMatch = memData.match(/MemAvailable:\s+(\d+)\s+kB/);
      
      if (totalMatch && availMatch) {
        const total = parseInt(totalMatch[1], 10) / 1024; // Convert to MB
        const available = parseInt(availMatch[1], 10) / 1024;
        const used = total - available;
        return used.toFixed(2);
      }
      return "0";
    } catch (error) {
      return "0";
    }
  }

  /**
   * Get total memory in MB (cached after first call)
   * @returns {Promise<string>} Total memory as string
   */
  async getTotalMemory() {
    // Return cached value if available
    if (this.cache.totalMemory !== null) {
      return this.cache.totalMemory;
    }

    try {
      const memData = await readFile('/proc/meminfo', 'utf8');
      const totalMatch = memData.match(/MemTotal:\s+(\d+)\s+kB/);
      
      if (totalMatch) {
        const totalMB = Math.round(parseInt(totalMatch[1], 10) / 1024);
        this.cache.totalMemory = totalMB.toString();
        return this.cache.totalMemory;
      }
      
      // Fallback to shell command
      const { stdout } = await this.exec("free -m | awk 'NR==2{printf \"%s\", $2}'");
      this.cache.totalMemory = stdout.trim();
      return this.cache.totalMemory;
    } catch (error) {
      return "0";
    }
  }

  /**
   * Get system uptime (kept for backward compatibility but not used in getStats)
   * @returns {Promise<string>} Uptime string (e.g., "2 hours, 30 minutes")
   */
  async getUptime() {
    try {
      const uptimeData = await readFile('/proc/uptime', 'utf8');
      const uptimeSeconds = parseFloat(uptimeData.split(' ')[0]);
      return this.formatUptime(uptimeSeconds);
    } catch (error) {
      return "Unknown";
    }
  }

  /**
   * Get load average (1, 5, 15 minutes) - kept for backward compatibility
   * @returns {Promise<string>} Load average string (e.g., "1.23 0.98 0.76")
   */
  async getLoadAverage() {
    try {
      const loadData = await readFile('/proc/loadavg', 'utf8');
      const parts = loadData.trim().split(' ');
      return `${parts[0] || '0.00'} ${parts[1] || '0.00'} ${parts[2] || '0.00'}`;
    } catch (error) {
      return "0.00 0.00 0.00";
    }
  }

  /**
   * Get number of CPU cores (cached after first call)
   * @returns {Promise<number>} Number of cores
   */
  async getCPUCores() {
    // Return cached value if available
    if (this.cache.cpuCores !== null) {
      return this.cache.cpuCores;
    }

    try {
      const cpuInfo = await readFile('/proc/cpuinfo', 'utf8');
      const processors = cpuInfo.match(/^processor\s*:/gm);
      const cores = processors ? processors.length : 1;
      this.cache.cpuCores = cores;
      return cores;
    } catch (error) {
      // Fallback to shell command
      try {
        const { stdout } = await this.exec("nproc");
        this.cache.cpuCores = parseInt(stdout.trim(), 10) || 1;
        return this.cache.cpuCores;
      } catch (fallbackError) {
        return 1;
      }
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
   * Get Node.js version (cached after first call)
   * @returns {Promise<string>} Node version (e.g., "v18.17.0")
   */
  async getNodeVersion() {
    // Return cached value if available
    if (this.cache.nodeVersion !== null) {
      return this.cache.nodeVersion;
    }

    try {
      const { stdout } = await this.exec("node --version");
      this.cache.nodeVersion = stdout.trim();
      return this.cache.nodeVersion;
    } catch (error) {
      this.cache.nodeVersion = "Unknown";
      return this.cache.nodeVersion;
    }
  }
}
