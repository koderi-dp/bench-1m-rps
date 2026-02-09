import { Router } from "express";
import { RedisService } from "../services/redis.service.js";

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

    const result = await redisService.setup?.(nodeCount);

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
    const result = await redisService.stop?.();

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
    const result = await redisService.clean?.();

    res.json({
      success: true,
      message: "Redis cluster clean initiated",
      result
    });
  } catch (error) {
    next(error);
  }
});

export { router as redisRouter };
