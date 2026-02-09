#!/usr/bin/env node

import { spawn, execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { BenchmarkHistory } from "./benchmark-history.js";
import { 
  isValidFramework, 
  getFrameworkNames, 
  getFrameworkPort,
  getEnabledFrameworks,
  CONFIG 
} from "./frameworks.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Parse arguments
const args = process.argv.slice(2);
let framework = null;
let host = "localhost";  // Target host (use IP for remote benchmarking)
let endpoint = CONFIG.defaultEndpoint;
let method = CONFIG.defaultMethod;
let duration = 20;
let connections = null;  // null = auto-scale based on instance count
let pipelining = null;   // null = auto-scale
let workers = null;       // null = auto-scale
let instanceHint = null;  // Manual instance count hint for auto-scaling (required for remote)
let userSetConnections = false;
let userSetPipelining = false;
let userSetWorkers = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case "-f":
    case "--framework":
      framework = args[++i];
      if (!isValidFramework(framework)) {
        log(`Invalid framework: ${framework}`, "red");
        log(`Valid options: ${getFrameworkNames().join(", ")}`, "gray");
        process.exit(1);
      }
      break;
    case "-H":
    case "--host":
      host = args[++i];
      break;
    case "-i":
    case "--instances":
      instanceHint = parseInt(args[++i]);
      if (isNaN(instanceHint) || instanceHint < 1) {
        log("Invalid instance count. Must be >= 1", "red");
        process.exit(1);
      }
      break;
    case "-e":
    case "--endpoint":
      endpoint = args[++i];
      if (!endpoint.startsWith("/")) {
        endpoint = "/" + endpoint;
      }
      break;
    case "-m":
    case "--method":
      method = args[++i].toUpperCase();
      break;
    case "-d":
    case "--duration":
      duration = parseInt(args[++i]);
      if (isNaN(duration) || duration < 1) {
        log("Invalid duration. Must be >= 1", "red");
        process.exit(1);
      }
      break;
    case "-c":
    case "--connections":
      connections = parseInt(args[++i]);
      userSetConnections = true;
      if (isNaN(connections) || connections < 1) {
        log("Invalid connections. Must be >= 1", "red");
        process.exit(1);
      }
      break;
    case "-w":
    case "--workers":
      workers = parseInt(args[++i]);
      userSetWorkers = true;
      break;
    case "-p":
    case "--pipelining":
      pipelining = parseInt(args[++i]);
      userSetPipelining = true;
      break;
    case "-h":
    case "--help":
      showUsage();
      process.exit(0);
    default:
      log(`Unknown option: ${arg}`, "red");
      showUsage();
      process.exit(1);
  }
}

function showUsage() {
  log("\n╔═══════════════════════════════════════════════════════════╗", "cyan");
  log("║          Benchmark Tool - Autocannon Wrapper              ║", "cyan");
  log("╚═══════════════════════════════════════════════════════════╝", "cyan");
  
  log("\nUsage: node bench.js -f <framework> [options]", "bold");
  
  log("\nRequired:", "yellow");
  log(`  -f, --framework <name>   Framework to benchmark: ${getFrameworkNames().join(", ")}`);
  
  log("\nOptions:", "yellow");
  log("  -H, --host <ip>          Target host (default: localhost)");
  log("                           Use this for remote benchmarking (e.g., 192.168.1.100)");
  log(`  -e, --endpoint <path>    Endpoint to test (default: ${CONFIG.defaultEndpoint})`);
  log(`  -m, --method <method>    HTTP method (default: ${CONFIG.defaultMethod})`);
  log("  -d, --duration <sec>     Test duration in seconds (default: 20)");
  log("  -i, --instances <num>    Number of instances (for auto-scaling)");
  log("                           Required for remote benchmarking, optional for local");
  log("  -c, --connections <num>  Number of connections (default: auto-scaled)");
  log("  -w, --workers <num>      Number of workers (default: auto-scaled)");
  log("  -p, --pipelining <num>   Pipelining factor (default: auto-scaled)");
  log("  -h, --help               Show this help message");
  
  log("\nFeatures:", "yellow");
  log("  ✓ Auto-scales connections/workers/pipelining based on instance count", "gray");
  log("  ✓ Local mode: auto-detects PM2 running instances", "gray");
  log("  ✓ Remote mode: benchmarks another machine (IP or hostname)", "gray");
  log("  ✓ Saves results to benchmark history (.bench-history.json)", "gray");
  log("  ✓ Shows helpful suggestions if server is unreachable", "gray");
  
  log("\nLocal Benchmarking (same machine):", "yellow");
  log(`  node bench.js -f ${getFrameworkNames()[0]}                      # Quick test`, "gray");
  log(`  node bench.js -f ${getFrameworkNames()[0]} -e /code -m POST     # POST request`, "gray");
  log(`  node bench.js -f ${getFrameworkNames()[1]} -d 30 -c 200         # Custom load`, "gray");
  
  log("\nRemote Benchmarking (different machine):", "yellow");
  log(`  node bench.js -f ${getFrameworkNames()[0]} -H 192.168.1.100 -i 10   # 10 instances`, "gray");
  log(`  node bench.js -f ${getFrameworkNames()[0]} -H prod.example.com -i 20 # Production`, "gray");
  log(`  node bench.js -f ${getFrameworkNames()[1]} -H 10.0.0.5 -i 5 -e /code # Custom endpoint`, "gray");
  
  log("\nFramework Ports:", "yellow");
  for (const fw of getEnabledFrameworks()) {
    log(`  ${fw.name.padEnd(8)} - http://localhost:${fw.port}`, "gray");
  }
  
  log("\n");
}

// Get port for framework
function getPort(fw) {
  return getFrameworkPort(fw);
}

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Check if PM2 has the framework running
function checkPM2Framework(targetFramework) {
  try {
    const output = execSync("pm2 jlist", { encoding: "utf-8" });
    const processes = JSON.parse(output);
    
    // Find running processes
    const running = processes.filter(p => p.pm2_env.status === "online");
    
    if (running.length === 0) {
      return {
        running: false,
        message: "No PM2 processes are running",
        suggestion: `Start ${targetFramework} with: node pm2.js -start -f ${targetFramework}`,
      };
    }
    
    // Check if target framework is running
    const targetRunning = running.some(p => p.name === targetFramework);
    
    if (!targetRunning) {
      const runningNames = [...new Set(running.map(p => p.name))].join(", ");
      return {
        running: false,
        message: `${targetFramework} is not running`,
        currentFramework: runningNames,
        suggestion: `Currently running: ${runningNames}\nSwitch to ${targetFramework} with: node pm2.js -delete && node pm2.js -start -f ${targetFramework}`,
      };
    }
    
    // Framework is running
    const instanceCount = running.filter(p => p.name === targetFramework).length;
    return {
      running: true,
      instances: instanceCount,
      message: `${targetFramework} is running with ${instanceCount} instances`,
    };
  } catch (error) {
    // PM2 not installed or no processes
    return {
      running: false,
      message: "PM2 is not running or not installed",
      suggestion: `Start ${targetFramework} with: node pm2.js -start -f ${targetFramework}`,
    };
  }
}

// Determine if running in remote mode (benchmarking a different machine)
function isRemoteHost() {
  return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
}

// Run benchmark
async function runBenchmark() {
  if (!framework) {
    log("\n❌ Framework is required!", "red");
    log("Usage: node bench.js -f <framework>", "gray");
    log("Example: node bench.js -f express\n", "gray");
    process.exit(1);
  }
  
  const remote = isRemoteHost();
  let instanceCount = 1;
  
  if (remote) {
    // Remote mode: skip PM2 check, use instance hint for scaling
    log(`\n🌐 Remote mode: benchmarking ${host}`, "cyan");
    
    if (instanceHint) {
      instanceCount = instanceHint;
      log(`✓ Using ${instanceCount} instances for auto-scaling (from -i flag)`, "green");
    } else if (!userSetConnections && !userSetWorkers && !userSetPipelining) {
      log(`⚠️  No instance count provided. Using defaults for 1 instance.`, "yellow");
      log(`   Tip: use -i <count> to auto-scale for the remote server's instance count`, "gray");
      log(`   Example: node bench.js -f ${framework} -H ${host} -i 20`, "gray");
    }
  } else {
    // Local mode: check PM2 for running instances
    log("\n🔍 Checking PM2 status...", "cyan");
    const pm2Check = checkPM2Framework(framework);
    
    if (!pm2Check.running) {
      log(`\n❌ ${pm2Check.message}`, "red");
      if (pm2Check.currentFramework) {
        log(`\n⚠️  ${pm2Check.suggestion}`, "yellow");
      } else {
        log(`\n💡 ${pm2Check.suggestion}`, "yellow");
      }
      log("\nBenchmark cancelled.\n", "gray");
      process.exit(1);
    }
    
    log(`✓ ${pm2Check.message}`, "green");
    instanceCount = pm2Check.instances || 1;
    
    // Allow -i to override PM2 detected count (e.g., if PM2 is behind a load balancer)
    if (instanceHint) {
      instanceCount = instanceHint;
      log(`  (overridden to ${instanceCount} instances via -i flag)`, "gray");
    }
  }
  
  // Auto-scale parameters based on instance count
  const scaled = {
    connections: Math.max(100, instanceCount * 50),
    workers: Math.max(4, Math.min(Math.ceil(instanceCount / 2), 16)),
    pipelining: instanceCount >= 10 ? 10 : instanceCount >= 4 ? 6 : 2,
  };
  
  // Apply auto-scaled values only if user didn't explicitly set them
  if (!userSetConnections) connections = scaled.connections;
  if (!userSetWorkers) workers = scaled.workers;
  if (!userSetPipelining) pipelining = scaled.pipelining;
  
  if (!userSetConnections || !userSetWorkers || !userSetPipelining) {
    log(`\n📊 Auto-scaled for ${instanceCount} instances:`, "cyan");
    if (!userSetConnections) log(`   Connections: ${connections} (${instanceCount} instances x 50)`, "gray");
    if (!userSetWorkers) log(`   Workers: ${workers}`, "gray");
    if (!userSetPipelining) log(`   Pipelining: ${pipelining}`, "gray");
  }
  
  const port = getPort(framework);
  const url = `http://${host}:${port}${endpoint}`;
  
  log("\n╔═══════════════════════════════════════════════════════════╗", "cyan");
  log("║                  Running Benchmark                        ║", "cyan");
  log("╚═══════════════════════════════════════════════════════════╝", "cyan");
  
  log(`\nFramework:   ${framework}`, "cyan");
  log(`Endpoint:    ${method} ${endpoint}`, "cyan");
  log(`URL:         ${url}`, "gray");
  log(`Duration:    ${duration}s`, "cyan");
  log(`Connections: ${connections}`, "cyan");
  log(`Workers:     ${workers}`, "cyan");
  log(`Pipelining:  ${pipelining}\n`, "cyan");
  
  // Build autocannon command
  const cmd = "npx";
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
  
  log("Running...\n", "yellow");
  
  return new Promise((resolve, reject) => {
    let jsonOutput = "";
    
    const child = spawn(cmd, cmdArgs, {
      cwd: __dirname,
      stdio: ["inherit", "pipe", "inherit"],
    });
    
    child.stdout.on("data", (data) => {
      jsonOutput += data.toString();
    });
    
    child.on("exit", async (code) => {
      if (code === 0) {
        try {
          const results = JSON.parse(jsonOutput);
          
          // Save to history
          await saveToHistory(results);
          
          displayResults(results);
          resolve(results);
        } catch (error) {
          log(`\n❌ Failed to parse results: ${error.message}`, "red");
          reject(error);
        }
      } else {
        log(`\n❌ Benchmark failed with code ${code}`, "red");
        log("Make sure the server is running!", "yellow");
        reject(new Error(`Benchmark failed with code ${code}`));
      }
    });
    
    child.on("error", (err) => {
      log(`\n❌ Error: ${err.message}`, "red");
      reject(err);
    });
  });
}

// Save results to history
async function saveToHistory(results) {
  try {
    const resultData = {
      timestamp: new Date().toISOString(),
      framework,
      endpoint,
      method,
      reqPerSec: Math.round(results.requests.average),
      avgLatency: parseFloat(results.latency.average.toFixed(2)),
      p50Latency: parseFloat(results.latency.p50.toFixed(2)),
      p90Latency: parseFloat(results.latency.p90.toFixed(2)),
      p99Latency: parseFloat(results.latency.p99.toFixed(2)),
      totalReqs: results.requests.total,
      duration: parseFloat(results.duration.toFixed(2)),
      connections,
      workers,
      pipelining,
      errors: results.errors || 0,
      timeouts: results.timeouts || 0,
      non2xx: results.non2xx || 0,
    };

    await BenchmarkHistory.add(resultData);
  } catch (error) {
    // Don't fail the benchmark if history save fails
    log(`\n⚠ Warning: Failed to save to history: ${error.message}`, "yellow");
  }
}

// Display results
function displayResults(results) {
  log("╔═══════════════════════════════════════════════════════════╗", "green");
  log("║                     Results                               ║", "green");
  log("╚═══════════════════════════════════════════════════════════╝", "green");
  
  const reqPerSec = Math.round(results.requests.average);
  const avgLatency = results.latency.average.toFixed(2);
  const p99Latency = results.latency.p99.toFixed(2);
  const totalReqs = results.requests.total;
  const errors = results.errors || 0;
  const timeouts = results.timeouts || 0;
  const non2xx = results.non2xx || 0;
  
  log(`\n  Requests/sec:     ${formatNumber(reqPerSec)}`, "bold");
  log(`  Avg Latency:      ${avgLatency} ms`, "cyan");
  log(`  P99 Latency:      ${p99Latency} ms`, "cyan");
  log(`  Total Requests:   ${formatNumber(totalReqs)}`, "cyan");
  log(`  Duration:         ${results.duration.toFixed(2)}s`, "cyan");
  
  if (errors > 0 || timeouts > 0 || non2xx > 0) {
    log(`\n  Errors:           ${errors}`, "yellow");
    log(`  Timeouts:         ${timeouts}`, "yellow");
    log(`  Non-2xx:          ${formatNumber(non2xx)}`, "yellow");
  }
  
  log("\n✓ Benchmark complete!\n", "green");
  
  // Output simple summary for dashboard parsing
  const summary = `BENCHMARK_RESULT:${framework}:${reqPerSec}:${avgLatency}:${totalReqs}`;
  log(summary, "gray");
}

// Main
runBenchmark().catch(() => {
  process.exit(1);
});
