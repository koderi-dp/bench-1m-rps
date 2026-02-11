import { Router } from "express";
import { RedisService } from "../services/redis.service.js";
import { info, error as logError } from "../services/logger.service.js";

const router = Router();
const redisService = new RedisService();

/**
 * GET /api/redis/nodes
 * Get list of detected Redis cluster nodes
 */
router.get("/nodes", async (req, res, next) => {
  try {
    const nodes = await redisService.detectNodes();
    
    res.json({
      nodes,
      count: nodes.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/redis/stats
 * Get Redis cluster statistics
 */
router.get("/stats", async (req, res, next) => {
  try {
    const stats = await redisService.getStats?.();
    
    res.json({
      stats: stats || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/redis/setup
 * Setup Redis cluster
 * Body: { nodeCount: number }
 */
router.post("/setup", async (req, res, next) => {
  try {
    const { nodeCount } = req.body;

    if (!nodeCount || nodeCount < 1) {
      return res.status(400).json({
        error: "Missing or invalid nodeCount"
      });
    }

    info(`Setting up Redis cluster with ${nodeCount} nodes`, { action: "redis.setup", nodeCount });
    const result = await redisService.setup?.(nodeCount);
    info(`Redis setup complete`, { action: "redis.setup", nodeCount, success: true });

    res.json({
      success: true,
      message: `Redis cluster setup initiated with ${nodeCount} nodes`,
      result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/redis/stop
 * Stop Redis cluster
 */
router.post("/stop", async (req, res, next) => {
  try {
    info("Stopping Redis cluster", { action: "redis.stop" });
    const result = await redisService.stop?.();
    info(`Redis stop: ${result?.message || "complete"}`, { action: "redis.stop", success: true });

    res.json({
      success: true,
      message: "Redis cluster stop initiated",
      result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/redis/clean
 * Clean Redis cluster data
 */
router.post("/clean", async (req, res, next) => {
  try {
    info("Cleaning Redis cluster", { action: "redis.clean" });
    const result = await redisService.clean?.();
    info(`Redis clean: ${result?.message || "complete"}`, { action: "redis.clean", success: true });

    res.json({
      success: true,
      message: "Redis cluster clean initiated",
      result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/redis/resume
 * Resume Redis cluster
 */
router.post("/resume", async (req, res, next) => {
  try {
    info("Resuming Redis cluster", { action: "redis.resume" });
    const result = await redisService.resume?.();
    info(`Redis resume: ${result?.message || "complete"}`, { action: "redis.resume", success: true });

    res.json({
      success: true,
      message: "Redis cluster resume initiated",
      result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/redis/status
 * Get Redis cluster status
 */
router.get("/status", async (req, res, next) => {
  try {
    const result = await redisService.status?.();
    info(`Redis status: ${result?.message || "queried"}`, { action: "redis.status" });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

export { router as redisRouter };
