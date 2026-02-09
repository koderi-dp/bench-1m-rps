/**
 * API Client Library
 * Provides easy interface for dashboard to communicate with API server
 */

import http from "http";
import https from "https";
import { WebSocket } from "ws";
import { info as logInfo, error as logError, warn as logWarn, debug as logDebug } from "./logger.service.js";

export class APIClient {
  constructor(baseURL = "http://localhost:3100", apiKey = null) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.wsURL = baseURL.replace(/^http/, "ws") + "/ws";
    this.ws = null;
    this.wsConnected = false;
    this.wsSubscriptions = new Map();
    this.wsCallbacks = {
      onConnect: null,
      onDisconnect: null,
      onError: null,
      onMetric: null
    };
  }

  /**
   * Make HTTP request to API
   */
  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseURL + path);
      const isHttps = url.protocol === "https:";
      const client = isHttps ? https : http;

      const options = {
        method,
        headers: {
          "Content-Type": "application/json"
        }
      };

      if (this.apiKey) {
        options.headers["X-API-Key"] = this.apiKey;
      }

      const req = client.request(url, options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            if (res.statusCode >= 400) {
              reject({
                status: res.statusCode,
                error: parsed?.error || "HTTP Error",
                message: parsed?.message || data,
                data: parsed
              });
            } else {
              resolve(parsed);
            }
          } catch (error) {
            reject({
              status: res.statusCode,
              error: "Parse Error",
              message: error.message,
              data: data
            });
          }
        });
      });

      req.on("error", reject);

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
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

  /**
   * DELETE request
   */
  async delete(path) {
    return this.request("DELETE", path);
  }

  /**
   * Health check
   */
  async health() {
    return this.get("/health");
  }

  // ==================== PM2 ====================

  /**
   * Get PM2 process stats
   */
  async pm2Stats() {
    const res = await this.get("/api/pm2/stats");
    return res;
  }

  /**
   * Start a framework
   */
  async pm2Start(framework, instances = 1) {
    return this.post("/api/pm2/start", { framework, instances });
  }

  /**
   * Stop a framework
   */
  async pm2Stop(framework) {
    return this.post("/api/pm2/stop", { framework });
  }

  /**
   * Restart a framework
   */
  async pm2Restart(framework) {
    return this.post("/api/pm2/restart", { framework });
  }

  /**
   * Delete a framework
   */
  async pm2Delete(framework) {
    return this.post("/api/pm2/delete", { framework });
  }

  /**
   * Delete all processes
   */
  async pm2DeleteAll() {
    return this.post("/api/pm2/deleteAll");
  }

  /**
   * Get logs
   */
  async pm2Logs(framework) {
    return this.post("/api/pm2/logs", { framework });
  }

  // ==================== System ====================

  /**
   * Get system metrics (CPU, memory, uptime, load)
   */
  async systemStats() {
    return this.get("/api/system/stats");
  }

  /**
   * Get CPU usage
   */
  async systemCPU() {
    return this.get("/api/system/cpu");
  }

  /**
   * Get memory info
   */
  async systemMemory() {
    return this.get("/api/system/memory");
  }

  // ==================== Redis ====================

  /**
   * Detect Redis nodes
   */
  async redisNodes() {
    return this.get("/api/redis/nodes");
  }

  /**
   * Get Redis stats
   */
  async redisStats() {
    return this.get("/api/redis/stats");
  }

  /**
   * Setup Redis cluster
   */
  async redisSetup(nodeCount) {
    return this.post("/api/redis/setup", { nodeCount });
  }

  /**
   * Stop Redis
   */
  async redisStop() {
    return this.post("/api/redis/stop");
  }

  /**
   * Clean Redis
   */
  async redisClean() {
    return this.post("/api/redis/clean");
  }

  // ==================== Benchmark ====================

  /**
   * Get latest benchmark results
   */
  async benchmarkLatest(count = 10) {
    return this.get(`/api/benchmark/latest?count=${count}`);
  }

  /**
   * Get all benchmark results
   */
  async benchmarkAll() {
    return this.get("/api/benchmark/all");
  }

  /**
   * Get results by framework
   */
  async benchmarkByFramework(framework) {
    return this.get(`/api/benchmark/by-framework/${framework}`);
  }

  /**
   * Get latest by framework
   */
  async benchmarkLatestByFramework() {
    return this.get("/api/benchmark/latest-by-framework");
  }

  /**
   * Run benchmark
   */
  async benchmarkRun(options) {
    return this.post("/api/benchmark/run", options);
  }

  /**
   * Reload benchmark history
   */
  async benchmarkReload() {
    return this.post("/api/benchmark/reload");
  }

  /**
   * Clear benchmark history
   */
  async benchmarkClear() {
    return this.delete("/api/benchmark/clear");
  }

  /**
   * Get benchmark stats
   */
  async benchmarkStats() {
    return this.get("/api/benchmark/stats");
  }

  // ==================== WebSocket ====================

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsURL);

         this.ws.addEventListener("open", () => {
           logInfo("Connected to API", { component: "api-client", event: "ws-connect" });
           this.wsConnected = true;
           if (this.wsCallbacks.onConnect) {
             this.wsCallbacks.onConnect();
           }
           resolve();
         });

         this.ws.addEventListener("message", (event) => {
           try {
             const message = JSON.parse(event.data);
             this._handleWSMessage(message);
           } catch (error) {
             logError("Error parsing message", { component: "api-client", event: "ws-message-parse", error: error.message });
           }
         });

         this.ws.addEventListener("close", () => {
           logInfo("Disconnected from API", { component: "api-client", event: "ws-disconnect" });
           this.wsConnected = false;
           if (this.wsCallbacks.onDisconnect) {
             this.wsCallbacks.onDisconnect();
           }
           // Attempt reconnect after delay
           setTimeout(() => this.connectWebSocket().catch(() => {}), 5000);
         });

         this.ws.addEventListener("error", (error) => {
           logError("WebSocket error", { component: "api-client", event: "ws-error", error: error.message || error });
           if (this.wsCallbacks.onError) {
             this.wsCallbacks.onError(error);
           }
           reject(error);
         });
      } catch (error) {
        reject(error);
      }
    });
  }

   /**
    * Handle incoming WebSocket message
    */
   _handleWSMessage(message) {
     switch (message.type) {
       case "connected":
         logDebug(`WebSocket connected with ID: ${message.clientId}`, { component: "api-client", stream: "connection" });
         break;

       case "subscribed":
         logDebug(`Subscribed to stream: ${message.stream}`, { component: "api-client", action: "subscribe" });
         break;

       case "unsubscribed":
         logDebug(`Unsubscribed from stream: ${message.stream}`, { component: "api-client", action: "unsubscribe" });
         this.wsSubscriptions.delete(message.stream);
         break;

       case "metric":
         if (this.wsCallbacks.onMetric) {
           this.wsCallbacks.onMetric(message.stream, message.data, message.timestamp);
         }
         break;

       case "error":
         logError(`Stream error: ${message.message}`, { component: "api-client", stream: message.stream });
         break;

       case "pong":
         // Ignore pong responses
         break;

       default:
         logDebug(`Unknown message type: ${message.type}`, { component: "api-client", messageType: message.type });
     }
   }

   /**
    * Subscribe to metric stream
    */
   subscribeToStream(stream, interval = 1000) {
     if (!this.wsConnected) {
       logError("Cannot subscribe - WebSocket not connected", { component: "api-client", stream, action: "subscribe" });
       return false;
     }

     if (this.wsSubscriptions.has(stream)) {
       logDebug(`Already subscribed to stream`, { component: "api-client", stream, action: "subscribe" });
       return true;
     }

    this.ws.send(
      JSON.stringify({
        type: "subscribe",
        stream,
        interval
      })
    );

    this.wsSubscriptions.set(stream, { interval });
    return true;
  }

   /**
    * Unsubscribe from metric stream
    */
   unsubscribeFromStream(stream) {
     if (!this.wsConnected) {
       logError("Cannot unsubscribe - WebSocket not connected", { component: "api-client", stream, action: "unsubscribe" });
       return false;
     }

    this.ws.send(
      JSON.stringify({
        type: "unsubscribe",
        stream
      })
    );

    return true;
  }

  /**
   * Set callback for metric updates
   */
  onMetric(callback) {
    this.wsCallbacks.onMetric = callback;
  }

  /**
   * Set callback for connection
   */
  onConnect(callback) {
    this.wsCallbacks.onConnect = callback;
  }

  /**
   * Set callback for disconnection
   */
  onDisconnect(callback) {
    this.wsCallbacks.onDisconnect = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback) {
    this.wsCallbacks.onError = callback;
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.wsConnected = false;
    }
  }

  /**
   * Send ping to keep connection alive
   */
  ping() {
    if (this.wsConnected) {
      this.ws.send(JSON.stringify({ type: "ping" }));
    }
  }
}

// Export singleton instance
let globalClient = null;

/**
 * Initialize global API client
 */
export function initAPIClient(baseURL = "http://localhost:3100", apiKey = null) {
  globalClient = new APIClient(baseURL, apiKey);
  return globalClient;
}

/**
 * Get global API client
 */
export function getAPIClient() {
  if (!globalClient) {
    globalClient = new APIClient();
  }
  return globalClient;
}
