import { Router } from "express";
import { SystemService } from "../services/system.service.js";
import {
  FRAMEWORKS,
  ENDPOINTS,
  CONFIG,
  getEnabledFrameworks,
  getFrameworkNames,
  getColorMapping,
  getPortMapping,
  getBenchmarkableEndpoints,
} from "../config/frameworks.config.js";

const router = Router();
const systemService = new SystemService();

/**
 * GET /api/system/stats
 * Get current system statistics (CPU, memory, uptime, load)
 */
router.get("/stats", async (req, res, next) => {
  try {
    const stats = await systemService.getStats();
    
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/system/memory
 * Get detailed memory information
 */
router.get("/memory", async (req, res, next) => {
  try {
    const totalMemory = await systemService.getTotalMemory();
    const memoryData = await systemService.getMemoryDetails?.();
    
    res.json({
      totalMemory,
      ...memoryData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/system/cpu
 * Get CPU usage percentage
 */
router.get("/cpu", async (req, res, next) => {
  try {
    const cpu = await systemService.getCPU();
    
    res.json({
      cpu,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/system/config
 * Get frameworks and endpoints configuration
 * Used by dashboard when running on remote machine
 */
router.get("/config", async (req, res, next) => {
  try {
    res.json({
      frameworks: getEnabledFrameworks(),
      frameworkNames: getFrameworkNames(),
      endpoints: ENDPOINTS,
      benchmarkableEndpoints: getBenchmarkableEndpoints(),
      colors: getColorMapping(),
      ports: getPortMapping(),
      defaults: CONFIG,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export { router as systemRouter };
