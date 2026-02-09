#!/usr/bin/env node

import { spawn, exec } from "child_process";
import { promisify } from "util";
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
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
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Auto-detect existing Redis cluster nodes
function detectExistingNodes() {
  const clusterPath = join(__dirname, "..", "redis-cluster");
  
  if (!existsSync(clusterPath)) {
    return [];
  }

  try {
    const entries = readdirSync(clusterPath, { withFileTypes: true });
    const ports = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => parseInt(entry.name))
      .filter((port) => !isNaN(port) && port >= 7000 && port < 8000)
      .sort((a, b) => a - b);
    
    return ports;
  } catch (error) {
    return [];
  }
}

// Parse arguments
const args = process.argv.slice(2);
let command = "";
let nodeCount = null; // null means auto-detect
let replicas = 1;
let isProduction = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case "-setup":
    case "-stop":
    case "-resume":
    case "-clean":
      command = arg.substring(1); // remove dash
      break;
    case "-prod":
      isProduction = true;
      break;
    case "-n":
    case "--nodes":
      nodeCount = parseInt(args[++i]);
      break;
    case "-r":
    case "--replicas":
      replicas = parseInt(args[++i]);
      break;
    default:
      log(`Unknown option: ${arg}`, "red");
      showUsage();
      process.exit(1);
  }
}

function showUsage() {
  log("\nUsage: node redis.js <command> [options]", "cyan");
  log("\nCommands:", "yellow");
  log("  -setup    Create and start Redis cluster");
  log("  -stop     Stop all cluster nodes (auto-detects nodes)");
  log("  -resume   Restart stopped cluster nodes (auto-detects nodes)");
  log("  -clean    Stop cluster and delete all data (auto-detects nodes)");
  log("\nOptions:", "yellow");
  log("  -n, --nodes <number>     Number of nodes (required for setup, auto-detected for others)");
  log("  -r, --replicas <number>  Replicas per master (default: 1, only for setup)");
  log("  -prod                    Use redis6-server/redis6-cli");
  log("\nExamples:", "yellow");
  log("  node redis.js -setup -n 6        # Setup requires -n", "gray");
  log("  node redis.js -stop              # Auto-detects nodes", "gray");
  log("  node redis.js -resume            # Auto-detects nodes", "gray");
  log("  node redis.js -clean             # Auto-detects nodes", "gray");
}

if (!command) {
  showUsage();
  process.exit(1);
}

// Auto-detect nodes for stop/resume/clean commands
if (command !== "setup" && nodeCount === null) {
  const detectedPorts = detectExistingNodes();
  
  if (detectedPorts.length === 0) {
    log(`\n✗ No existing Redis cluster nodes found in ../redis-cluster/`, "red");
    log("Tip: Run setup first with: node redis.js -setup -n 6", "yellow");
    process.exit(1);
  }
  
  // Calculate nodeCount from detected ports
  nodeCount = detectedPorts.length;
  log(`\n🔍 Auto-detected ${nodeCount} Redis cluster nodes: ${detectedPorts.join(", ")}`, "cyan");
}

// Validate - setup requires explicit nodeCount
if (command === "setup" && nodeCount === null) {
  log(`\n✗ Setup command requires -n flag to specify number of nodes`, "red");
  log("Example: node redis.js -setup -n 6", "yellow");
  process.exit(1);
}

// Validate node count
if (isNaN(nodeCount) || nodeCount < 3) {
  log(`Invalid node count: ${nodeCount} (minimum 3)`, "red");
  process.exit(1);
}

let masters; // Declare here so it's available in setup()

// Validate topology only for setup command
if (command === "setup") {
  if (isNaN(replicas) || replicas < 0) {
    log(`Invalid replicas count: ${replicas}`, "red");
    process.exit(1);
  }

  masters = Math.floor(nodeCount / (replicas + 1));
  if (masters * (replicas + 1) !== nodeCount || masters < 3) {
    log("Invalid topology: nodes must be divisible by (replicas + 1) and have at least 3 masters", "red");
    process.exit(1);
  }
}

const startPort = 7000;
const endPort = startPort + nodeCount - 1;
const clusterDir = join(__dirname, "..", "redis-cluster");

const redisServer = isProduction ? "redis6-server" : "redis-server";
const redisCli = isProduction ? "redis6-cli" : "redis-cli";

// ==================== COMMANDS ====================

async function setup() {
  log(`\n🚀 Setting up Redis cluster with ${nodeCount} nodes (${masters} masters, ${replicas} replicas per master)\n`, "cyan");

  // Create cluster directory
  if (!existsSync(clusterDir)) {
    mkdirSync(clusterDir, { recursive: true });
  }

  // Create config for each node
  for (let port = startPort; port <= endPort; port++) {
    const portDir = join(clusterDir, port.toString());
    mkdirSync(portDir, { recursive: true });

    const config = `port ${port}
cluster-enabled yes
cluster-config-file nodes.conf
cluster-node-timeout 5000
save ""
appendonly no
protected-mode no
bind 127.0.0.1
maxclients 100000
`;

    writeFileSync(join(portDir, "redis.conf"), config);
    log(`✓ Created config for port ${port}`, "green");
  }

  // Start all Redis instances
  log("\n⏳ Starting Redis instances...", "yellow");
  for (let port = startPort; port <= endPort; port++) {
    const portDir = join(clusterDir, port.toString());
    const confFile = join(portDir, "redis.conf");

    try {
      await execAsync(`${redisServer} "${confFile}" --daemonize yes --dir "${portDir}"`);
      log(`✓ Started Redis on port ${port}`, "green");
    } catch (error) {
      log(`✗ Failed to start Redis on port ${port}: ${error.message}`, "red");
      process.exit(1);
    }
  }

  // Wait for Redis to be ready
  log("\n⏳ Waiting for Redis instances to be ready...", "yellow");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Create cluster
  log("\n⏳ Creating cluster...", "yellow");
  const hosts = [];
  for (let port = startPort; port <= endPort; port++) {
    hosts.push(`127.0.0.1:${port}`);
  }

  const clusterCmd = `${redisCli} --cluster create ${hosts.join(" ")} --cluster-replicas ${replicas} --cluster-yes`;
  
  try {
    const { stdout, stderr } = await execAsync(clusterCmd);
    if (stdout) log(stdout, "gray");
    if (stderr) log(stderr, "yellow");
    log("\n✅ Redis cluster created successfully!", "green");
  } catch (error) {
    log(`\n✗ Failed to create cluster: ${error.message}`, "red");
    process.exit(1);
  }
}

async function stop() {
  log(`\n⏸️  Stopping Redis cluster (${nodeCount} nodes)...\n`, "yellow");

  for (let port = startPort; port <= endPort; port++) {
    try {
      await execAsync(`${redisCli} -p ${port} shutdown`);
      log(`✓ Stopped Redis on port ${port}`, "green");
    } catch (error) {
      log(`⚠ Port ${port} not running or already stopped`, "gray");
    }
  }

  // Kill any remaining processes
  try {
    const isWindows = process.platform === "win32";
    if (isWindows) {
      await execAsync(`taskkill /F /IM ${redisServer}.exe 2>nul || echo done`);
    } else {
      await execAsync(`pkill -f "${redisServer}.*redis-cluster" 2>/dev/null || true`);
    }
  } catch (error) {
    // Ignore errors
  }

  log("\n✅ Redis cluster stopped", "green");
}

async function resume() {
  log(`\n▶️  Resuming Redis cluster (${nodeCount} nodes)...\n`, "cyan");

  if (!existsSync(clusterDir)) {
    log("✗ Cluster directory not found. Run 'setup' first.", "red");
    process.exit(1);
  }

  for (let port = startPort; port <= endPort; port++) {
    const portDir = join(clusterDir, port.toString());
    const confFile = join(portDir, "redis.conf");

    if (!existsSync(confFile)) {
      log(`⚠ Config not found for port ${port}`, "yellow");
      continue;
    }

    try {
      await execAsync(`${redisServer} "${confFile}" --daemonize yes --dir "${portDir}"`);
      log(`✓ Resumed Redis on port ${port}`, "green");
    } catch (error) {
      log(`✗ Failed to resume Redis on port ${port}: ${error.message}`, "red");
    }
  }

  log("\n✅ Redis cluster resumed", "green");
}

async function clean() {
  log(`\n🧹 Cleaning Redis cluster (${nodeCount} nodes)...\n`, "yellow");

  // Stop all nodes first
  for (let port = startPort; port <= endPort; port++) {
    try {
      await execAsync(`${redisCli} -p ${port} shutdown`);
      log(`✓ Stopped Redis on port ${port}`, "green");
    } catch (error) {
      log(`⚠ Port ${port} not running`, "gray");
    }
  }

  // Kill any remaining processes
  try {
    const isWindows = process.platform === "win32";
    if (isWindows) {
      await execAsync(`taskkill /F /IM ${redisServer}.exe 2>nul || echo done`);
    } else {
      await execAsync(`pkill -f "${redisServer}.*redis-cluster" 2>/dev/null || true`);
    }
  } catch (error) {
    // Ignore errors
  }

  // Delete data directories
  log("\n🗑️  Deleting data directories...", "yellow");
  for (let port = startPort; port <= endPort; port++) {
    const portDir = join(clusterDir, port.toString());
    if (existsSync(portDir)) {
      rmSync(portDir, { recursive: true, force: true });
      log(`✓ Deleted data for port ${port}`, "green");
    }
  }

  // Remove cluster directory if empty
  if (existsSync(clusterDir)) {
    const remaining = readdirSync(clusterDir);
    if (remaining.length === 0) {
      rmSync(clusterDir, { recursive: true });
      log("✓ Removed cluster directory", "green");
    } else {
      log(`⚠ Cluster directory not empty (${remaining.length} items remaining)`, "yellow");
    }
  }

  log("\n✅ Redis cluster cleaned", "green");
}

// ==================== MAIN ====================

(async () => {
  try {
    switch (command) {
      case "setup":
        await setup();
        break;
      case "stop":
        await stop();
        break;
      case "resume":
        await resume();
        break;
      case "clean":
        await clean();
        break;
      default:
        log(`Unknown command: ${command}`, "red");
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    log(`\n✗ Error: ${error.message}`, "red");
    process.exit(1);
  }
})();
