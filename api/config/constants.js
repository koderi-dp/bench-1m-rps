/**
 * API Configuration Constants
 */

export const COLORS = {
  success: "green",
  error: "red",
  warning: "yellow"
};

export const LIMITS = {
  maxBenchmarkResults: 100,
  maxLogLines: 1000
};

export const PERFORMANCE = {
  updateInterval: 1000, // 1 second
  cacheMaxAge: 5000 // 5 seconds
};

export const TIMEOUTS = {
  pm2Command: 10000,
  pm2Stats: 10000,
  command: 10000,
  benchmarkStart: 30000,
  benchmarkTimeout: 60000,
  redisStats: 5000
};

export const BUFFERS = {
  commandOutput: 1024 * 1024, // 1MB
  pm2Output: 5 * 1024 * 1024 // 5MB
};
