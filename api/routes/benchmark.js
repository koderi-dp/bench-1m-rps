import { Router } from "express";
import { BenchmarkService } from "../services/benchmark.service.js";

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
 * POST /api/benchmark/run
 * Run a benchmark against target framework
 * Body: {
 *   framework: string,
 *   host: string (default: localhost),
 *   endpoint: string (default: /simple),
 *   method: string (default: GET),
 *   duration: number (default: 20),
 *   connections?: number,
 *   pipelining?: number,
 *   workers?: number,
 *   instances?: number
 * }
 */
router.post("/run", async (req, res, next) => {
  try {
    const {
      framework,
      host = "localhost",
      endpoint = "/simple",
      method = "GET",
      duration = 20,
      connections,
      pipelining,
      workers,
      instances
    } = req.body;

    if (!framework) {
      return res.status(400).json({
        error: "Missing required field: framework"
      });
    }

    // Return immediately, benchmark runs in background
    res.status(202).json({
      status: "accepted",
      message: "Benchmark queued for execution",
      benchmark: {
        framework,
        host,
        endpoint,
        method,
        duration,
        connections,
        pipelining,
        workers,
        instances
      }
    });

    // Run benchmark in background
    benchmarkService.runBenchmark({
      framework,
      host,
      endpoint,
      method,
      duration,
      connections,
      pipelining,
      workers,
      instances
    }).catch(err => {
      console.error("Benchmark execution error:", err);
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
