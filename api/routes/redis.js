import { Router } from "express";
import { info, error as logError } from "../services/logger.service.js";
import { redisAgentClient } from "../utils/redis-agent.client.js";

const router = Router();

/**
 * GET /api/redis/nodes
 * Get list of detected Redis cluster nodes
 */
router.get("/nodes", async (req, res, next) => {
  try {
    const data = await redisAgentClient.nodes();
    res.json(data);
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
    const data = await redisAgentClient.stats();
    res.json(data);
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
    const data = await redisAgentClient.status();
    info(`Redis status queried via agent`, { action: "redis.status" });
    res.json(data);
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

    const data = await redisAgentClient.setup(nodeCount);
    info(`Setting up Redis cluster with ${nodeCount} nodes via agent`, { action: "redis.setup", nodeCount });
    res.json(data);
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
    const data = await redisAgentClient.stop();
    info("Stopping Redis cluster via agent", { action: "redis.stop" });
    res.json(data);
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
    const data = await redisAgentClient.clean();
    info("Cleaning Redis cluster via agent", { action: "redis.clean" });
    res.json(data);
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
    const data = await redisAgentClient.resume();
    info("Resuming Redis cluster via agent", { action: "redis.resume" });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export { router as redisRouter };
