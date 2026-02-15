/**
 * Redis Agent Client Library
 * Provides interface for API to communicate with Redis Agent.
 * Redis Agent is mandatory - defaults to http://localhost:3200 if REDIS_AGENT_URL is not set.
 */

export class RedisAgentClient {
  constructor(baseURL = null) {
    this.baseURL = baseURL || (process.env.REDIS_AGENT_URL || "http://localhost:3200").replace(/\/$/, "");
  }

  /**
   * Get the Redis Agent URL
   */
  getBaseURL() {
    return this.baseURL;
  }

  /**
   * Make HTTP request to Redis Agent
   */
  async request(method, path, body = null) {
    const url = `${this.baseURL}${path}`;
    const init = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body && typeof body === "object" && !(body instanceof Buffer)) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Redis Agent error (${res.status}): ${text || res.statusText}`);
    }

    return res.json();
  }

  /**
   * GET request
   */
  async get(path) {
    return this.request("GET", path);
  }

  /**
   * POST request
   */
  async post(path, body) {
    return this.request("POST", path, body);
  }

  // ==================== Redis Operations ====================

  /**
   * Detect Redis nodes
   */
  async nodes() {
    return this.get("/api/redis/nodes");
  }

  /**
   * Get Redis cluster statistics
   */
  async stats() {
    return this.get("/api/redis/stats");
  }

  /**
   * Get Redis cluster status
   */
  async status() {
    return this.get("/api/redis/status");
  }

  /**
   * Setup Redis cluster
   */
  async setup(nodeCount) {
    return this.post("/api/redis/setup", { nodeCount });
  }

  /**
   * Stop Redis cluster
   */
  async stop() {
    return this.post("/api/redis/stop");
  }

  /**
   * Resume Redis cluster
   */
  async resume() {
    return this.post("/api/redis/resume");
  }

  /**
   * Clean Redis cluster data
   */
  async clean() {
    return this.post("/api/redis/clean");
  }
}

// Default instance (singleton pattern)
const defaultClient = new RedisAgentClient();

// Export both class and default instance for convenience
export { defaultClient as redisAgentClient };
