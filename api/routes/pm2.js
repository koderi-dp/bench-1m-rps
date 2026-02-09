import { Router } from "express";
import { PM2Service } from "../services/pm2.service.js";

const router = Router();
const pm2Service = new PM2Service();

/**
 * GET /api/pm2/stats
 * Get current PM2 process statistics
 */
router.get("/stats", async (req, res, next) => {
  try {
    const stats = await pm2Service.getStats();
    const counts = pm2Service.countOnline(stats);
    
    res.json({
      processes: stats,
      counts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pm2/start
 * Start a framework with PM2
 * Body: { framework: string, instances: number }
 */
router.post("/start", async (req, res, next) => {
  try {
    const { framework, instances } = req.body;

    if (!framework) {
      return res.status(400).json({
        error: "Missing required field: framework"
      });
    }

    const instanceCount = instances || 1;
    const result = await pm2Service.start(framework, instanceCount);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pm2/stop
 * Stop a framework
 * Body: { framework: string }
 */
router.post("/stop", async (req, res, next) => {
  try {
    const { framework } = req.body;

    if (!framework) {
      return res.status(400).json({
        error: "Missing required field: framework"
      });
    }

    const result = await pm2Service.stop(framework);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pm2/restart
 * Restart a framework
 * Body: { framework: string }
 */
router.post("/restart", async (req, res, next) => {
  try {
    const { framework } = req.body;

    if (!framework) {
      return res.status(400).json({
        error: "Missing required field: framework"
      });
    }

    const result = await pm2Service.restart(framework);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pm2/delete
 * Delete a framework
 * Body: { framework: string }
 */
router.post("/delete", async (req, res, next) => {
  try {
    const { framework } = req.body;

    if (!framework) {
      return res.status(400).json({
        error: "Missing required field: framework"
      });
    }

    const result = await pm2Service.delete(framework);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pm2/deleteAll
 * Delete all PM2 processes
 */
router.post("/deleteAll", async (req, res, next) => {
  try {
    const result = await pm2Service.deleteAll();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pm2/logs
 * Get logs for a framework
 * Body: { framework: string }
 */
router.post("/logs", async (req, res, next) => {
  try {
    const { framework } = req.body;

    if (!framework) {
      return res.status(400).json({
        error: "Missing required field: framework"
      });
    }

    const result = await pm2Service.logs(framework);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as pm2Router };
