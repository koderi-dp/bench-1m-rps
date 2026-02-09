import { eventBus } from "../services/events.service.js";
import { error as logError } from "../services/logger.service.js";

/**
 * UpdateController - Manages dashboard refresh cycle
 * Fetches data from services and emits events for widgets to subscribe to
 */
export class UpdateController {
  constructor(services, chartDataManager, screen = null) {
    this.services = services;
    this.chartDataManager = chartDataManager;
    this.screen = screen;
    this.intervalId = null;
  }

  /**
   * Update all dashboard components in parallel
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
   */
  startLoop(interval = 2000) {
    // Initial update
    this.updateAll();

    // Start interval
    this.intervalId = setInterval(() => {
      this.updateAll();
    }, interval);
  }

  /**
   * Stop the update loop
   */
  stopLoop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Manual refresh (called by 'r' key)
   */
  async refresh() {
    await this.updateAll();
  }
}
