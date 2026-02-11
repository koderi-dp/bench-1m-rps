import { Router } from "express";
import { BenchmarkService } from "../services/benchmark.service.js";
import { info } from "../services/logger.service.js";

const router = Router();
const benchmarkService = new BenchmarkService();

/**
 * GET /api/benchmark/latest
 * Get latest benchmark results
 * Query: ?count=10 (default: 10)
 */
router.get("/latest", async (req, res, next) => {
  try {
    const count = parseInt(req.query.count) || 10;
    const results = await benchmarkService.getLatest(count);

    res.json({
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/benchmark/all
 * Get all benchmark results
 */
router.get("/all", async (req, res, next) => {
  try {
    const results = await benchmarkService.getAll();

    res.json({
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/benchmark/by-framework/:framework
 * Get results for specific framework
 */
router.get("/by-framework/:framework", async (req, res, next) => {
  try {
    const { framework } = req.params;
    const results = await benchmarkService.getByFramework(framework);

    res.json({
      framework,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/benchmark/latest-by-framework
 * Get latest result for each framework+endpoint combination
 */
router.get("/latest-by-framework", async (req, res, next) => {
  try {
    const results = await benchmarkService.getLatestByFramework();

    res.json({
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/benchmark/add
 * Add a benchmark result to history
 */
router.post("/add", async (req, res, next) => {
  try {
    const result = req.body || {};

    if (!result.framework) {
      return res.status(400).json({
        error: "Missing required field: framework"
      });
    }

    if (!result.timestamp) {
      result.timestamp = new Date().toISOString();
    }

    info(`Benchmark result: ${result.framework} ${result.endpoint} - ${result.reqPerSec} req/s`, {
      action: "benchmark.add",
      framework: result.framework,
      endpoint: result.endpoint,
      reqPerSec: result.reqPerSec,
      avgLatency: result.avgLatency,
    });

    const success = await benchmarkService.add(result);

    res.status(201).json({
      success,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/benchmark/reload
 * Reload benchmark history from disk
 */
router.post("/reload", async (req, res, next) => {
  try {
    const reloaded = await benchmarkService.reload();

    res.json({
      success: true,
      message: "Benchmark history reloaded",
      reloaded
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/benchmark/clear
 * Clear all benchmark history
 */
router.delete("/clear", async (req, res, next) => {
  try {
    const success = await benchmarkService.clear();

    res.json({
      success,
      message: "Benchmark history cleared"
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/benchmark/stats
 * Get benchmark statistics summary
 */
router.get("/stats", async (req, res, next) => {
  try {
    const stats = await benchmarkService.getStats();

    res.json({
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export { router as benchmarkRouter };
