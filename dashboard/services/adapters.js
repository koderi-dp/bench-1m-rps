/**
 * Service Adapter
 * Provides the same interface as local services but uses API client
 */

export class PM2ServiceAdapter {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async getStats() {
    const res = await this.apiClient.pm2Stats();
    return res.processes;
  }

  countOnline(stats) {
    if (!stats || !Array.isArray(stats)) {
      return { online: 0, total: 0 };
    }
    const onlineCount = stats.filter(s => s && s.includes("online")).length;
    return {
      online: onlineCount,
      total: stats.length
    };
  }

  async start(framework, instances) {
    return this.apiClient.pm2Start(framework, instances);
  }

  async stop(framework) {
    return this.apiClient.pm2Stop(framework);
  }

  async restart(framework) {
    return this.apiClient.pm2Restart(framework);
  }

  async delete(framework) {
    return this.apiClient.pm2Delete(framework);
  }

  async deleteAll() {
    return this.apiClient.pm2DeleteAll();
  }

  async logs(framework) {
    return this.apiClient.pm2Logs(framework);
  }
}

export class RedisServiceAdapter {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.updateCallback = null;
  }

  setUpdateCallback(callback) {
    this.updateCallback = callback;
  }

  invalidateCache() {
    // Remote API handles caching, nothing to do on client
    return true;
  }

  async detectNodes() {
    const res = await this.apiClient.redisNodes();
    return res.nodes;
  }

  async getStats() {
    const res = await this.apiClient.redisStats();
    return res.stats || [];
  }

  countOnline(stats) {
    if (!stats || !Array.isArray(stats)) {
      return { online: 0, total: 0 };
    }
    const notRunning = stats.some(s => s && s.includes("not running"));
    if (notRunning) {
      return { online: 0, total: 0 };
    }
    return {
      online: stats.length,
      total: stats.length
    };
  }

  async getCodeCount() {
    // API server would need to expose this endpoint
    // For now, return 0 (not critical for dashboard)
    return 0;
  }

  async setup(nodeCount) {
    return this.apiClient.redisSetup(nodeCount);
  }

  async stop() {
    return this.apiClient.redisStop();
  }

  async clean() {
    return this.apiClient.redisClean();
  }
}

export class SystemServiceAdapter {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async getStats() {
    return this.apiClient.systemStats();
  }

  async getCPU() {
    const res = await this.apiClient.systemCPU();
    return res.cpu;
  }

  async getTotalMemory() {
    const res = await this.apiClient.systemMemory();
    return res.totalMemory;
  }

  async getMemoryDetails() {
    return this.apiClient.systemMemory();
  }
}

export class BenchmarkServiceAdapter {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async getLatest(count = 10) {
    const res = await this.apiClient.benchmarkLatest(count);
    return res.results;
  }

  async reload() {
    return this.apiClient.benchmarkReload();
  }

  async getAll() {
    const res = await this.apiClient.benchmarkAll();
    return res.results;
  }

  async getLatestByFramework() {
    return this.apiClient.benchmarkLatestByFramework();
  }

  async getByFramework(framework) {
    const res = await this.apiClient.benchmarkByFramework(framework);
    return res.results;
  }

  async add(result) {
    // API doesn't support adding directly - results come from bench.js
    return true;
  }

  async clear() {
    return this.apiClient.benchmarkClear();
  }

  async getStats() {
    const res = await this.apiClient.benchmarkStats();
    return res.stats;
  }

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

  parseBenchmarkOutput(output) {
    try {
      const match = output.match(/BENCHMARK_RESULT:(.+)/);
      if (!match) return null;
      return JSON.parse(match[1]);
    } catch (error) {
      return null;
    }
  }

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
}
