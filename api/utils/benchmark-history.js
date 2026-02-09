#!/usr/bin/env node

import { readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getFrameworkNames } from "../../frameworks.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HISTORY_FILE = join(__dirname, "../../.bench-history.json");
const MAX_RESULTS = 20;

/**
 * Benchmark History Manager
 * Handles persistent storage of benchmark results with automatic rotation
 */
export class BenchmarkHistory {
  static historyData = null;

  /**
   * Load history from file or create new empty history
   */
  static async load() {
    try {
      // Check if file exists
      await access(HISTORY_FILE);
      
      // Read and parse file
      const content = await readFile(HISTORY_FILE, "utf-8");
      const data = JSON.parse(content);
      
      // Validate schema
      if (!data.version || !Array.isArray(data.results)) {
        console.warn("Invalid history file format, creating new history");
        return this.createEmpty();
      }
      
      this.historyData = data;
      return data;
    } catch (error) {
      if (error.code === "ENOENT") {
        // File doesn't exist, create new
        return this.createEmpty();
      }
      
      console.warn(`Error loading history: ${error.message}`);
      return this.createEmpty();
    }
  }

  /**
   * Create empty history structure
   */
  static createEmpty() {
    this.historyData = {
      version: "1.0",
      lastUpdated: new Date().toISOString(),
      results: [],
    };
    return this.historyData;
  }

  /**
   * Save history to file
   */
  static async save(data = null) {
    const toSave = data || this.historyData;
    
    if (!toSave) {
      console.warn("No history data to save");
      return false;
    }

    try {
      toSave.lastUpdated = new Date().toISOString();
      
      // Write to file with pretty formatting
      await writeFile(HISTORY_FILE, JSON.stringify(toSave, null, 2), "utf-8");
      
      return true;
    } catch (error) {
      console.error(`Error saving history: ${error.message}`);
      return false;
    }
  }

  /**
   * Add new benchmark result
   * Automatically rotates history to keep last MAX_RESULTS entries
   */
  static async add(result) {
    // Ensure history is loaded
    if (!this.historyData) {
      await this.load();
    }

    // Validate result
    if (!result || !result.framework || !result.timestamp) {
      console.warn("Invalid result data, skipping save");
      return false;
    }

    // Add timestamp if not present
    if (!result.timestamp) {
      result.timestamp = new Date().toISOString();
    }

    // Add to results array (newest first)
    this.historyData.results.unshift(result);

    // Rotate if exceeds max
    if (this.historyData.results.length > MAX_RESULTS) {
      this.historyData.results = this.historyData.results.slice(0, MAX_RESULTS);
    }

    // Save to file
    return await this.save();
  }

  /**
   * Force reload history from disk
   * Use this to refresh cache when file was modified by another process
   */
  static async reload() {
    this.historyData = null; // Clear cache
    return await this.load();
  }

  /**
   * Get latest N results
   */
  static async getLatest(count = 3) {
    if (!this.historyData) {
      await this.load();
    }

    return this.historyData.results.slice(0, count);
  }

  /**
   * Get all results for a specific framework
   */
  static async getByFramework(framework) {
    if (!this.historyData) {
      await this.load();
    }

    return this.historyData.results.filter(r => r.framework === framework);
  }

  /**
   * Get all results
   */
  static async getAll() {
    if (!this.historyData) {
      await this.load();
    }

    return this.historyData.results;
  }

  /**
   * Get latest result for each framework+endpoint+method combination
   * Returns: { "cpeak:/simple:GET": {...}, "cpeak:/code:POST": {...}, ... }
   */
  static async getLatestByFramework() {
    if (!this.historyData) {
      await this.load();
    }

    const latest = {};

    // Iterate through results (newest first) and keep first occurrence of each combo
    for (const result of this.historyData.results) {
      const key = `${result.framework}:${result.endpoint}:${result.method}`;
      
      // Only store if we haven't seen this combination yet (keeps newest)
      if (!latest[key]) {
        latest[key] = result;
      }
    }

    return latest;
  }

  /**
   * Clear all history
   */
  static async clear() {
    this.createEmpty();
    return await this.save();
  }

  /**
   * Get summary statistics
   */
  static async getStats() {
    if (!this.historyData) {
      await this.load();
    }

    const results = this.historyData.results;
    
    if (results.length === 0) {
      return {
        total: 0,
        byFramework: {},
      };
    }

    const stats = {
      total: results.length,
      byFramework: {},
    };

    // Calculate stats per framework (dynamically from config)
    for (const framework of getFrameworkNames()) {
      const frameworkResults = results.filter(r => r.framework === framework);
      
      if (frameworkResults.length > 0) {
        const reqPerSecs = frameworkResults.map(r => r.reqPerSec);
        const latencies = frameworkResults.map(r => r.avgLatency);
        
        stats.byFramework[framework] = {
          count: frameworkResults.length,
          avgReqPerSec: Math.round(reqPerSecs.reduce((a, b) => a + b, 0) / reqPerSecs.length),
          maxReqPerSec: Math.max(...reqPerSecs),
          minReqPerSec: Math.min(...reqPerSecs),
          avgLatency: (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
        };
      }
    }

    return stats;
  }
}

// Auto-load on import
await BenchmarkHistory.load();
