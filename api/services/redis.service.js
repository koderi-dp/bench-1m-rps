import { readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execRedisCommand } from "../utils/exec.js";
import { COLORS } from "../config/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Redis Service
 * Handles Redis cluster operations and statistics
 */
export class RedisService {
  constructor(execFn = execRedisCommand, redisClient = null) {
    this.exec = execFn;
    this.redis = redisClient;
    // Redis cluster is one level up from project root
    this.clusterPath = join(__dirname, "../../redis-cluster");
    
    // Cache for master ports (refreshed every 5s)
    this.masterPortsCache = null;
    this.lastMasterPortsCacheTime = 0;
    this.CACHE_TTL = 5000; // 5 seconds
    
    // Callback for immediate updates after operations
    this.updateCallback = null;
  }

  /**
   * Set update callback for immediate dashboard refresh
   * @param {Function} callback - Function to call after Redis operations
   */
  setUpdateCallback(callback) {
    this.updateCallback = callback;
  }

  /**
   * Detect active Redis nodes by checking filesystem
   * @returns {Promise<Array<number>>} Array of port numbers
   */
  async detectNodes() {
    try {
      const entries = await readdir(this.clusterPath);
      const ports = entries
        .map(name => parseInt(name, 10))
        .filter(port => !isNaN(port) && port >= 7000 && port <= 7999)
        .sort((a, b) => a - b);
      
      return ports;
    } catch (error) {
      // Cluster directory doesn't exist or can't be read
      return [];
    }
  }

  /**
   * Get master node ports from cluster (cached for 5 seconds)
   * @returns {Promise<Array<number>>} Array of master node ports
   */
  async getMasterPorts() {
    // Return cached value if still valid
    const now = Date.now();
    if (this.masterPortsCache !== null && (now - this.lastMasterPortsCacheTime) < this.CACHE_TTL) {
      return this.masterPortsCache;
    }

    try {
      const ports = await this.detectNodes();
      if (ports.length === 0) {
        this.masterPortsCache = [];
        this.lastMasterPortsCacheTime = now;
        return [];
      }

      // Query first node to get cluster topology
      const { stdout } = await this.exec(`redis-cli -p ${ports[0]} CLUSTER NODES`).catch(() => ({ stdout: '' }));
      
      if (!stdout) {
        // Fallback: assume all nodes are masters if we can't query cluster
        this.masterPortsCache = ports;
        this.lastMasterPortsCacheTime = now;
        return ports;
      }

      // Parse cluster nodes output
      // Format: <id> <ip:port@cport> <flags> ...
      // Look for nodes with 'master' flag (not 'slave')
      const masterPorts = [];
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        if (line.includes('master') && !line.includes('slave')) {
          const match = line.match(/127\.0\.0\.1:(\d+)/);
          if (match) {
            const port = parseInt(match[1], 10);
            if (port >= 7000 && port <= 7999) {
              masterPorts.push(port);
            }
          }
        }
      }

      const sortedPorts = masterPorts.sort((a, b) => a - b);
      this.masterPortsCache = sortedPorts;
      this.lastMasterPortsCacheTime = now;
      return sortedPorts;
    } catch (error) {
      // On error, invalidate cache and try to detect nodes
      this.masterPortsCache = null;
      this.lastMasterPortsCacheTime = 0;
      return this.detectNodes();
    }
  }

  /**
   * Invalidate master ports cache (useful after cluster changes)
   */
  invalidateCache() {
    this.masterPortsCache = null;
    this.lastMasterPortsCacheTime = 0;
  }

  /**
   * Get statistics for Redis cluster masters
   * @returns {Promise<Array<string>>} Formatted stats with color tags
   */
  async getStats() {
    try {
      const masterPorts = await this.getMasterPorts();
      
      if (masterPorts.length === 0) {
        return ["{gray-fg}Redis cluster not running{/gray-fg}"];
      }

      // Get stats for all master nodes
      const stats = await Promise.all(
        masterPorts.map(port => this.getNodeStats(port))
      );

      return stats.filter(Boolean);
    } catch (error) {
      return [`Error loading Redis: ${error.message}`];
    }
  }

  /**
   * Get statistics for a single Redis node
   * @param {number} port - Redis port number
   * @returns {Promise<string|null>} Formatted stats or null on error
   */
  async getNodeStats(port) {
    try {
      // Run commands in parallel for this node
      const [statsResult, memoryResult, clientsResult] = await Promise.all([
        this.exec(`redis-cli -p ${port} INFO stats`).catch(() => ({ stdout: '' })),
        this.exec(`redis-cli -p ${port} INFO memory`).catch(() => ({ stdout: '' })),
        this.exec(`redis-cli -p ${port} INFO clients`).catch(() => ({ stdout: '' }))
      ]);

      // Parse ops/sec from stats
      const opsMatch = statsResult.stdout.match(/instantaneous_ops_per_sec:(\d+)/);
      const opsPerSec = opsMatch ? parseInt(opsMatch[1], 10) : 0;

      // Parse memory usage
      const memMatch = memoryResult.stdout.match(/used_memory_human:([^\r\n]+)/);
      const memory = memMatch ? memMatch[1].trim() : "0B";

      // Parse connection count
      const connMatch = clientsResult.stdout.match(/connected_clients:(\d+)/);
      const connections = connMatch ? parseInt(connMatch[1], 10) : 0;

      // Format output
      const portDisplay = `${port}`.padEnd(6);
      const opsDisplay = `${opsPerSec.toLocaleString()}`.padStart(10);
      const memDisplay = memory.padStart(10);
      const connDisplay = `${connections}`.padStart(8);

      const color = opsPerSec > 0 ? COLORS.success : COLORS.warning;

      return `{${color}-fg}${portDisplay}  ${opsDisplay} ops/s  ${memDisplay}  ${connDisplay} conn{/${color}-fg}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Count online nodes
   * @param {Array<string>} stats - Formatted stats from getStats()
   * @returns {{online: number, total: number}}
   */
  countOnline(stats) {
    const notRunning = stats.some(s => s.includes("not running"));
    if (notRunning) {
      return { online: 0, total: 0 };
    }

    return {
      online: stats.length,
      total: stats.length
    };
  }

  /**
   * Get total code count from Redis
   * @returns {Promise<number>} Total codes stored
   */
  async getCodeCount() {
    if (!this.redis) {
      return 0;
    }

    try {
      const count = await this.redis.get("codes:seq");
      return parseInt(count, 10) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Setup Redis cluster
   * @param {number} nodes - Number of nodes
   * @param {number} replicas - Replicas per master
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async setup(nodes, replicas) {
    try {
      const { stdout } = await this.exec(`node redis.js -setup -n ${nodes} -r ${replicas}`);
      
      // Invalidate cache after cluster changes
      this.invalidateCache();
      
      // Trigger immediate dashboard update
      if (this.updateCallback) {
        this.updateCallback();
      }
      
      if (stdout.includes("ready")) {
        return {
          success: true,
          message: `Redis cluster started: ${nodes} nodes, ${replicas} replicas`
        };
      }

      return {
        success: false,
        message: `Redis setup: ${stdout.substring(0, 60)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Stop Redis cluster
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async stop() {
    try {
      const { stdout } = await this.exec("node redis.js -stop");
      
      // Invalidate cache after cluster changes
      this.invalidateCache();
      
      // Trigger immediate dashboard update
      if (this.updateCallback) {
        this.updateCallback();
      }
      
      const offlineCount = (stdout.match(/offline/gi) || []).length;
      return {
        success: true,
        message: `Redis cluster stopped (${offlineCount} nodes)`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Resume Redis cluster
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async resume() {
    try {
      const { stdout } = await this.exec("node redis.js -resume");
      
      // Invalidate cache after cluster changes
      this.invalidateCache();
      
      // Trigger immediate dashboard update
      if (this.updateCallback) {
        this.updateCallback();
      }
      
      const onlineCount = (stdout.match(/online/gi) || []).length;
      return {
        success: true,
        message: `Redis cluster resumed (${onlineCount} nodes online)`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Clean Redis data
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async clean() {
    try {
      await this.exec("node redis.js -clean");
      
      // Invalidate cache after cluster changes
      this.invalidateCache();
      
      // Trigger immediate dashboard update
      if (this.updateCallback) {
        this.updateCallback();
      }
      
      return {
        success: true,
        message: "Redis data cleaned"
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Get cluster status
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async status() {
    try {
      const { stdout } = await this.exec("node redis.js -status");
      
      const onlineCount = (stdout.match(/online/gi) || []).length;
      return {
        success: true,
        message: `Redis status: ${onlineCount} nodes online`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
}
