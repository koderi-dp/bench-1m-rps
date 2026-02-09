// Import logger service for file logging
import { error as logError } from "../services/logger.service.js";
import { eventBus } from "../services/events.service.js";

/**
 * UpdateController - Manages dashboard refresh cycle
 * Fetches data from services and updates UI widgets
 * 
 * Implements dual-lane update system:
 * - Fast lane (1s): CPU, memory, PM2 CPU/mem (volatile data)
 * - Slow lane (5s): System info, uptime, load avg (stable data)
 */
export class UpdateController {
  constructor(services, chartDataManager, screen = null) {
    this.services = services;
    this.chartDataManager = chartDataManager;
    this.screen = screen;
    
    // Dual interval system
    this.fastIntervalId = null;
    this.slowIntervalId = null;
    this.fastInterval = 1000;  // 1 second for volatile data
    this.slowInterval = 5000;  // 5 seconds for stable data
    
    // Track if we should use variable intervals
    this.useVariableIntervals = false;
  }

  /**
   * Update all dashboard components in parallel (legacy single-interval mode)
   */
  async updateAll() {
    try {
      await Promise.all([
        this.updateCharts(), // Also updates system info now
        this.updatePM2(),
        this.updateRedis(),
        this.updateBenchmark(),
      ]);
      
      // Render screen after updates
      if (this.screen) {
        this.screen.render();
      }
    } catch (err) {
      logError(err, {
        source: "controller",
        controller: "update",
        action: "updateAll"
      });
    }
  }

  /**
   * Update fast lane - volatile data (1s interval)
   * CPU, memory charts, PM2 stats, Redis stats
   */
  async updateFastLane() {
    try {
      await Promise.all([
        this.updateCharts(),
        this.updatePM2(),
        this.updateRedis(),
      ]);
      
      // Render screen after updates
      if (this.screen) {
        this.screen.render();
      }
    } catch (err) {
      logError(err, {
        source: "controller",
        controller: "update",
        action: "updateFastLane"
      });
    }
  }

  /**
   * Update slow lane - stable data (5s interval)
   * System info, benchmark results
   */
  async updateSlowLane() {
    try {
      await Promise.all([
        this.updateBenchmark(),
      ]);
      
      // Render screen after updates
      if (this.screen) {
        this.screen.render();
      }
    } catch (err) {
      logError(err, {
        source: "controller",
        controller: "update",
        action: "updateSlowLane"
      });
    }
  }

  /**
   * Update CPU and Memory charts AND system info
   */
  async updateCharts() {
    try {
      const stats = await this.services.system.getStats();
      const codeCount = await this.services.redis.getCodeCount();
      
      // Add data point to chart manager
      this.chartDataManager.addDataPoint(stats.cpu, stats.memory);

      // Get chart data
      const cpuData = this.chartDataManager.getCPUData();
      const memoryData = this.chartDataManager.getMemoryData();

      // Emit event for BOTH charts and system info to subscribe to
      eventBus.emitSystemStats({
        ...stats,
        codeCount,
        cpuData,
        memoryData,
      });
    } catch (err) {
      logError(err, {
        source: "controller",
        controller: "update",
        action: "updateCharts"
      });
    }
  }

  /**
   * Update PM2 process list
   */
  async updatePM2() {
    try {
      const stats = await this.services.pm2.getStats();
      const counts = this.services.pm2.countOnline(stats);

      // Emit event for PM2 widget to subscribe to
      eventBus.emitPM2Stats(stats, counts);
    } catch (err) {
      logError(err, {
        source: "controller",
        controller: "update",
        action: "updatePM2"
      });
    }
  }

  /**
   * Update Redis node list
   */
  async updateRedis() {
    try {
      const stats = await this.services.redis.getStats();
      const counts = this.services.redis.countOnline(stats);

      // Emit event for Redis widget to subscribe to
      eventBus.emitRedisStats(stats, counts);
    } catch (err) {
      logError(err, {
        source: "controller",
        controller: "update",
        action: "updateRedis"
      });
    }
  }

  /**
   * Update benchmark summary table
   */
  async updateBenchmark() {
    try {
      const results = await this.services.benchmark.getLatest(3);

      // Emit event for benchmark widget to subscribe to
      eventBus.emitBenchmarkUpdate(results);
    } catch (err) {
      logError(err, {
        source: "controller",
        controller: "update",
        action: "updateBenchmark"
      });
    }
  }

  /**
   * Start the update loop
   * @param {number} interval - Update interval in milliseconds (default: 2000)
   * @param {boolean} useVariableIntervals - Use fast/slow lanes (default: false)
   */
  startLoop(interval = 2000, useVariableIntervals = false) {
    this.useVariableIntervals = useVariableIntervals;

    if (useVariableIntervals) {
      // Variable interval mode - fast and slow lanes
      this.updateFastLane(); // Initial fast lane update
      this.updateSlowLane(); // Initial slow lane update
      
      // Start fast lane (1s)
      this.fastIntervalId = setInterval(() => {
        this.updateFastLane();
      }, this.fastInterval);
      
      // Start slow lane (5s)
      this.slowIntervalId = setInterval(() => {
        this.updateSlowLane();
      }, this.slowInterval);
    } else {
      // Legacy mode - single interval for all updates
      this.updateAll();
      
      this.intervalId = setInterval(() => {
        this.updateAll();
      }, interval);
    }
  }

  /**
   * Stop the update loop
   */
  stopLoop() {
    // Stop both interval types
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.fastIntervalId) {
      clearInterval(this.fastIntervalId);
      this.fastIntervalId = null;
    }
    
    if (this.slowIntervalId) {
      clearInterval(this.slowIntervalId);
      this.slowIntervalId = null;
    }
  }

  /**
   * Manual refresh (called by 'r' key)
   */
  async refresh() {
    if (this.useVariableIntervals) {
      // In variable interval mode, refresh both lanes
      await Promise.all([
        this.updateFastLane(),
        this.updateSlowLane()
      ]);
    } else {
      await this.updateAll();
    }
  }
}
