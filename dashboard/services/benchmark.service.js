/**
 * Benchmark Service
 * 
 * Runs autocannon benchmarks. Uses API client to check PM2 status.
 */

import { spawn } from "child_process";

/**
 * Check if PM2 has the framework running via API
 * @param {Object} apiClient - API client instance
 * @param {string} targetFramework - Framework name
 * @returns {Promise<Object>} { running, instances, message, suggestion }
 */
export async function checkPM2Framework(apiClient, targetFramework) {
  try {
    const response = await apiClient.pm2Stats();
    const processes = response.processes || [];
    
    // Parse the formatted strings to check status
    // Format: "{color-fg}  pid  name        status    cpu     mem{/color-fg}"
    if (processes.length === 0 || processes[0].includes("No PM2 processes")) {
      return {
        running: false,
        instances: 0,
        message: "No PM2 processes are running",
        suggestion: `Start ${targetFramework} first`,
      };
    }
    
    // Count running instances of target framework
    let instanceCount = 0;
    let hasOtherFrameworks = false;
    const otherFrameworks = new Set();
    
    for (const proc of processes) {
      // Check if this process line contains the framework name and is online
      const isOnline = proc.includes("online");
      const containsTarget = proc.includes(targetFramework);
      
      if (isOnline && containsTarget) {
        instanceCount++;
      } else if (isOnline) {
        // Try to extract framework name from the line
        const match = proc.match(/\d+\s+(\w+)\s+online/);
        if (match) {
          otherFrameworks.add(match[1]);
          hasOtherFrameworks = true;
        }
      }
    }
    
    if (instanceCount === 0) {
      const runningNames = Array.from(otherFrameworks).join(", ");
      return {
        running: false,
        instances: 0,
        message: `${targetFramework} is not running`,
        currentFramework: runningNames || undefined,
        suggestion: hasOtherFrameworks ? `Currently running: ${runningNames}` : `Start ${targetFramework} first`,
      };
    }
    
    return {
      running: true,
      instances: instanceCount,
      message: `${targetFramework} running with ${instanceCount} instances`,
    };
  } catch (error) {
    return {
      running: false,
      instances: 0,
      message: `Failed to check PM2 status: ${error.message}`,
      suggestion: `Start ${targetFramework} first`,
    };
  }
}

/**
 * Auto-scale benchmark parameters based on instance count
 * @param {number} instanceCount - Number of server instances
 * @returns {Object} { connections, workers, pipelining }
 */
export function autoScaleParams(instanceCount) {
  return {
    connections: Math.max(100, instanceCount * 50),
    workers: Math.max(4, Math.min(Math.ceil(instanceCount / 2), 16)),
    pipelining: instanceCount >= 10 ? 10 : instanceCount >= 4 ? 6 : 2,
  };
}

/**
 * Run a benchmark
 * @param {Object} options - Benchmark options
 * @param {Object} options.apiClient - API client for PM2 status check and target host
 * @param {string} options.framework - Framework name
 * @param {number} options.port - Port number
 * @param {string} [options.host] - Target host (defaults to API server host from apiClient)
 * @param {string} [options.endpoint="/simple"] - Endpoint path
 * @param {string} [options.method="GET"] - HTTP method
 * @param {number} [options.duration=20] - Duration in seconds
 * @param {number} [options.connections] - Connections (auto-scaled if not set)
 * @param {number} [options.workers] - Workers (auto-scaled if not set)
 * @param {number} [options.pipelining] - Pipelining (auto-scaled if not set)
 * @param {number} [options.instances] - Instance count for auto-scaling (skips PM2 check if provided)
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<Object>} Benchmark results
 */
export async function runBenchmark(options) {
  const {
    apiClient,
    framework,
    port,
    endpoint = "/simple",
    method = "GET",
    duration = 20,
    onProgress,
  } = options;

  // Get target host from apiClient if not explicitly provided
  // This ensures benchmarks target the API server's machine, not localhost
  const host = options.host || (apiClient?.getTargetHost?.() ?? "localhost");

  if (!framework || !port) {
    throw new Error("framework and port are required");
  }

  // Determine instance count for auto-scaling
  let instanceCount = options.instances || 1;

  // If instances not provided, check PM2 via API
  if (!options.instances && apiClient) {
    const pm2Check = await checkPM2Framework(apiClient, framework);
    if (!pm2Check.running) {
      throw new Error(pm2Check.message + (pm2Check.suggestion ? `. ${pm2Check.suggestion}` : ""));
    }
    instanceCount = pm2Check.instances;
  }

  // Auto-scale parameters
  const scaled = autoScaleParams(instanceCount);
  const connections = options.connections || scaled.connections;
  const workers = options.workers || scaled.workers;
  const pipelining = options.pipelining || scaled.pipelining;

  const url = `http://${host}:${port}${endpoint}`;

  // Build autocannon command
  const cmdArgs = [
    "autocannon",
    "-j", // JSON output
    "-m", method,
    "-c", connections.toString(),
    "-d", duration.toString(),
    "-p", pipelining.toString(),
    "-w", workers.toString(),
  ];

  // Add body for POST requests
  if (method === "POST") {
    cmdArgs.push("-H", "Content-Type=application/json");
    cmdArgs.push("-b", JSON.stringify({ name: "benchmark" }));
  }

  cmdArgs.push(url);

  if (onProgress) {
    onProgress({
      status: "starting",
      framework,
      host,
      url,
      connections,
      workers,
      pipelining,
      duration,
      instances: instanceCount,
    });
  }

  return new Promise((resolve, reject) => {
    let jsonOutput = "";

    const child = spawn("npx", cmdArgs, {
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => {
      jsonOutput += data.toString();
    });

    child.stderr.on("data", (data) => {
      // Autocannon progress goes to stderr
      if (onProgress) {
        onProgress({ status: "running", output: data.toString() });
      }
    });

    child.on("exit", (code) => {
      if (code === 0) {
        try {
          const results = JSON.parse(jsonOutput);
          const resultData = buildResultData(results, {
            framework,
            endpoint,
            method,
            connections,
            workers,
            pipelining,
          });

          if (onProgress) {
            onProgress({ status: "complete", results: resultData });
          }

          resolve(resultData);
        } catch (error) {
          reject(new Error(`Failed to parse results: ${error.message}`));
        }
      } else {
        reject(new Error(`Benchmark failed with code ${code}. Is the server running?`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to run autocannon: ${err.message}`));
    });
  });
}

/**
 * Build standardized result data from autocannon output
 */
function buildResultData(results, meta) {
  return {
    timestamp: new Date().toISOString(),
    framework: meta.framework,
    endpoint: meta.endpoint,
    method: meta.method,
    reqPerSec: Math.round(results.requests.average),
    avgLatency: parseFloat(results.latency.average.toFixed(2)),
    p50Latency: parseFloat(results.latency.p50.toFixed(2)),
    p90Latency: parseFloat(results.latency.p90.toFixed(2)),
    p99Latency: parseFloat(results.latency.p99.toFixed(2)),
    totalReqs: results.requests.total,
    duration: parseFloat(results.duration.toFixed(2)),
    connections: meta.connections,
    workers: meta.workers,
    pipelining: meta.pipelining,
    errors: results.errors || 0,
    timeouts: results.timeouts || 0,
    non2xx: results.non2xx || 0,
  };
}
