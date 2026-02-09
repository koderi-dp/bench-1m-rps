import { EventEmitter } from "events";

/**
 * Central event bus for dashboard
 * Services emit events when data changes
 * Widgets subscribe to these events
 */
class DashboardEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Increase for multiple widgets
  }

  /**
   * Emit system stats update
   */
  emitSystemStats(stats) {
    this.emit("system:stats", stats);
  }

  /**
   * Emit PM2 stats update
   */
  emitPM2Stats(stats, counts) {
    this.emit("pm2:stats", { stats, counts });
  }

  /**
   * Emit Redis stats update
   */
  emitRedisStats(stats, counts) {
    this.emit("redis:stats", { stats, counts });
  }

  /**
   * Emit benchmark results update
   */
  emitBenchmarkUpdate(results) {
    this.emit("benchmark:update", results);
  }

  /**
   * Subscribe to system stats
   */
  onSystemStats(callback) {
    this.on("system:stats", callback);
    return () => this.off("system:stats", callback);
  }

  /**
   * Subscribe to PM2 stats
   */
  onPM2Stats(callback) {
    this.on("pm2:stats", callback);
    return () => this.off("pm2:stats", callback);
  }

  /**
   * Subscribe to Redis stats
   */
  onRedisStats(callback) {
    this.on("redis:stats", callback);
    return () => this.off("redis:stats", callback);
  }

  /**
   * Subscribe to benchmark updates
   */
  onBenchmarkUpdate(callback) {
    this.on("benchmark:update", callback);
    return () => this.off("benchmark:update", callback);
  }
}

// Singleton instance
export const eventBus = new DashboardEventBus();
