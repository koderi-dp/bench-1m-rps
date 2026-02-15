#!/usr/bin/env node

/**
 * Redis Agent - runs on the Redis machine and exposes the same Redis API
 * as the main API. Used for remote Redis cluster management.
 */

import express from "express";
import { createServer } from "http";
import { RedisService } from "./services/redis.service.js";
import { info, error as logError, requestLogger } from "./services/logger.service.js";

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(requestLogger);

const PORT = process.env.REDIS_AGENT_PORT || 3200;
const HOST = process.env.REDIS_AGENT_HOST || "0.0.0.0";

const redisService = new RedisService();

/**
 * GET /api/redis/nodes
 * Get list of detected Redis cluster nodes
 */
app.get("/api/redis/nodes", async (req, res, next) => {
  try {
    const nodes = await redisService.detectNodes();
    res.json({
      nodes,
      count: nodes.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/redis/stats
 * Get Redis cluster statistics
 */
app.get("/api/redis/stats", async (req, res, next) => {
  try {
    const stats = await redisService.getStats?.();
    res.json({
      stats: stats || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/redis/status
 * Get Redis cluster status
 */
app.get("/api/redis/status", async (req, res, next) => {
  try {
    const result = await redisService.status?.();
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/redis/setup
 * Setup Redis cluster. Uses --bind-remote so Redis is reachable from the API machine.
 * Body: { nodeCount: number }
 */
app.post("/api/redis/setup", async (req, res, next) => {
  try {
    const { nodeCount } = req.body;

    if (!nodeCount || nodeCount < 1) {
      return res.status(400).json({
        error: "Missing or invalid nodeCount"
      });
    }

    info(`Setting up Redis cluster with ${nodeCount} nodes`, { action: "redis.setup", nodeCount });
    const result = await redisService.setup?.(nodeCount, null, { bindRemote: true });
    info(`Redis setup complete`, { action: "redis.setup", nodeCount, success: true });

    res.json({
      success: true,
      message: `Redis cluster setup initiated with ${nodeCount} nodes`,
      result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/redis/stop
 * Stop Redis cluster
 */
app.post("/api/redis/stop", async (req, res, next) => {
  try {
    info("Stopping Redis cluster", { action: "redis.stop" });
    const result = await redisService.stop?.();
    info(`Redis stop: ${result?.message || "complete"}`, { action: "redis.stop", success: true });
    res.json({
      success: true,
      message: "Redis cluster stop initiated",
      result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/redis/resume
 * Resume Redis cluster
 */
app.post("/api/redis/resume", async (req, res, next) => {
  try {
    info("Resuming Redis cluster", { action: "redis.resume" });
    const result = await redisService.resume?.();
    info(`Redis resume: ${result?.message || "complete"}`, { action: "redis.resume", success: true });
    res.json({
      success: true,
      message: "Redis cluster resume initiated",
      result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/redis/clean
 * Clean Redis cluster data
 */
app.post("/api/redis/clean", async (req, res, next) => {
  try {
    info("Cleaning Redis cluster", { action: "redis.clean" });
    const result = await redisService.clean?.();
    info(`Redis clean: ${result?.message || "complete"}`, { action: "redis.clean", success: true });
    res.json({
      success: true,
      message: "Redis cluster clean initiated",
      result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Health check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "redis-agent",
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  logError(err, { action: "error_handler", path: req.path });
  res.status(500).json({
    error: err.message || "Internal server error"
  });
});

// Start server
server.listen(PORT, HOST, () => {
  info(`Redis Agent started`, { host: HOST, port: PORT });
  info(`Endpoints: /api/redis/nodes, /api/redis/stats, /api/redis/status`);
  info(`          POST /api/redis/setup, /stop, /resume, /clean`);
  info(`Health check: GET http://${HOST}:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  info("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  info("SIGINT received, shutting down gracefully...");
  server.close(() => {
    info("Server closed");
    process.exit(0);
  });
});

export { app, server };
