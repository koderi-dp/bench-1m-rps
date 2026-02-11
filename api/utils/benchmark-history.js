#!/usr/bin/env node

import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getFrameworkNames } from "../config/frameworks.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiRoot = join(__dirname, "..");

const dataDir = join(apiRoot, "data");
const DB_FILE = join(dataDir, "benchmark-history.db");
const MAX_RESULTS = 20;

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

/**
 * Benchmark History Manager backed by SQLite (better-sqlite3)
 */
export class BenchmarkHistory {
  static db = null;
  static initialized = false;

  static init() {
    if (this.initialized) return;

    this.db = new Database(DB_FILE);
    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS benchmark_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        framework TEXT NOT NULL,
        endpoint TEXT,
        method TEXT,
        reqPerSec INTEGER,
        avgLatency REAL,
        p50Latency REAL,
        p90Latency REAL,
        p99Latency REAL,
        totalReqs INTEGER,
        duration REAL,
        connections INTEGER,
        workers INTEGER,
        pipelining INTEGER,
        errors INTEGER DEFAULT 0,
        timeouts INTEGER DEFAULT 0,
        non2xx INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_bench_timestamp
      ON benchmark_results(timestamp DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_bench_framework
      ON benchmark_results(framework);

      CREATE INDEX IF NOT EXISTS idx_bench_combo
      ON benchmark_results(framework, endpoint, method, timestamp DESC);
    `);

    this.initialized = true;
  }

  static rotate() {
    this.db.exec(`
      DELETE FROM benchmark_results
      WHERE id NOT IN (
        SELECT id
        FROM benchmark_results
        ORDER BY timestamp DESC, id DESC
        LIMIT ${MAX_RESULTS}
      )
    `);
  }

  static mapRow(row) {
    return {
      timestamp: row.timestamp,
      framework: row.framework,
      endpoint: row.endpoint,
      method: row.method,
      reqPerSec: row.reqPerSec,
      avgLatency: row.avgLatency,
      p50Latency: row.p50Latency,
      p90Latency: row.p90Latency,
      p99Latency: row.p99Latency,
      totalReqs: row.totalReqs,
      duration: row.duration,
      connections: row.connections,
      workers: row.workers,
      pipelining: row.pipelining,
      errors: row.errors,
      timeouts: row.timeouts,
      non2xx: row.non2xx,
    };
  }

  /**
   * Compatibility method retained for existing callers
   */
  static async load() {
    this.init();
    const total = this.db.prepare("SELECT COUNT(*) AS total FROM benchmark_results").get().total;
    const latest = await this.getLatest(MAX_RESULTS);

    return {
      version: "2.0-sqlite",
      lastUpdated: latest[0]?.timestamp || new Date().toISOString(),
      results: latest,
      total,
    };
  }

  static createEmpty() {
    return {
      version: "2.0-sqlite",
      lastUpdated: new Date().toISOString(),
      results: [],
    };
  }

  /**
   * Compatibility no-op for file-based API
   */
  static async save() {
    this.init();
    return true;
  }

  static async add(result) {
    this.init();

    if (!result || !result.framework) {
      return false;
    }

    const insert = this.db.prepare(`
      INSERT INTO benchmark_results (
        timestamp, framework, endpoint, method,
        reqPerSec, avgLatency, p50Latency, p90Latency, p99Latency,
        totalReqs, duration, connections, workers, pipelining,
        errors, timeouts, non2xx
      ) VALUES (
        @timestamp, @framework, @endpoint, @method,
        @reqPerSec, @avgLatency, @p50Latency, @p90Latency, @p99Latency,
        @totalReqs, @duration, @connections, @workers, @pipelining,
        @errors, @timeouts, @non2xx
      )
    `);

    insert.run({
      timestamp: result.timestamp || new Date().toISOString(),
      framework: result.framework,
      endpoint: result.endpoint || "/",
      method: result.method || "GET",
      reqPerSec: result.reqPerSec ?? 0,
      avgLatency: result.avgLatency ?? 0,
      p50Latency: result.p50Latency ?? 0,
      p90Latency: result.p90Latency ?? 0,
      p99Latency: result.p99Latency ?? 0,
      totalReqs: result.totalReqs ?? 0,
      duration: result.duration ?? 0,
      connections: result.connections ?? 0,
      workers: result.workers ?? 0,
      pipelining: result.pipelining ?? 0,
      errors: result.errors ?? 0,
      timeouts: result.timeouts ?? 0,
      non2xx: result.non2xx ?? 0,
    });

    this.rotate();
    return true;
  }

  static async reload() {
    this.init();
    return this.load();
  }

  static async getLatest(count = 3) {
    this.init();

    const rows = this.db
      .prepare(`
        SELECT *
        FROM benchmark_results
        ORDER BY timestamp DESC, id DESC
        LIMIT ?
      `)
      .all(count);

    return rows.map((row) => this.mapRow(row));
  }

  static async getByFramework(framework) {
    this.init();

    const rows = this.db
      .prepare(`
        SELECT *
        FROM benchmark_results
        WHERE framework = ?
        ORDER BY timestamp DESC, id DESC
      `)
      .all(framework);

    return rows.map((row) => this.mapRow(row));
  }

  static async getAll() {
    this.init();

    const rows = this.db
      .prepare(`
        SELECT *
        FROM benchmark_results
        ORDER BY timestamp DESC, id DESC
      `)
      .all();

    return rows.map((row) => this.mapRow(row));
  }

  static async getLatestByFramework() {
    this.init();

    const rows = await this.getAll();
    const latest = {};

    for (const result of rows) {
      const key = `${result.framework}:${result.endpoint}:${result.method}`;
      if (!latest[key]) {
        latest[key] = result;
      }
    }

    return latest;
  }

  static async clear() {
    this.init();
    this.db.exec("DELETE FROM benchmark_results");
    return true;
  }

  static async getStats() {
    this.init();

    const results = await this.getAll();

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

    for (const framework of getFrameworkNames()) {
      const frameworkResults = results.filter((r) => r.framework === framework);

      if (frameworkResults.length > 0) {
        const reqPerSecs = frameworkResults.map((r) => r.reqPerSec || 0);
        const latencies = frameworkResults.map((r) => r.avgLatency || 0);

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

// Initialize on import for fast first request
await BenchmarkHistory.load();
