#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getEnabledFrameworks, getBenchmarkableEndpoints } from "./frameworks.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color helpers
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Generate dynamic commands from frameworks.config.js
function generateCommands() {
  const commands = {
    start: {
      desc: "Launch interactive dashboard",
      cmd: "node dashboard.js",
    },
    dashboard: {
      desc: "Launch interactive dashboard (alias for start)",
      cmd: "node dashboard.js",
    },
    
    // Quick actions
    quickstart: {
      desc: "Setup Redis + Start Express (auto setup)",
      cmd: "npm run quickstart",
    },
    cleanup: {
      desc: "Stop everything and clean all data",
      cmd: "pm2 delete all 2>/dev/null || true && node redis.js -clean",
    },

    // Redis commands
    "redis setup": {
      desc: "Setup Redis Cluster (6 nodes)",
      cmd: "node redis.js -setup -n 6",
    },
    "redis start": {
      desc: "Setup Redis Cluster (6 nodes)",
      cmd: "node redis.js -setup -n 6",
    },
    "redis stop": {
      desc: "Stop Redis Cluster (auto-detects nodes)",
      cmd: "node redis.js -stop",
    },
    "redis resume": {
      desc: "Resume stopped Redis Cluster (auto-detects nodes)",
      cmd: "node redis.js -resume",
    },
    "redis clean": {
      desc: "Delete all Redis data & nodes (auto-detects nodes)",
      cmd: "node redis.js -clean",
    },
    "redis status": {
      desc: "Check Redis Cluster status",
      cmd: "redis-cli -p 7000 cluster info",
    },

    // PM2 commands (static)
    "pm2 stop": {
      desc: "Stop all PM2 processes",
      cmd: "node pm2.js -stop",
    },
    "pm2 delete": {
      desc: "Delete all PM2 processes",
      cmd: "node pm2.js -delete",
    },
    "pm2 restart": {
      desc: "Restart all PM2 processes",
      cmd: "node pm2.js -restart",
    },
    "pm2 logs": {
      desc: "View PM2 logs (live)",
      cmd: "node pm2.js -logs",
    },
    "pm2 status": {
      desc: "View PM2 process status",
      cmd: "node pm2.js -status",
    },
  };

  // Dynamically add PM2 and benchmark commands for each enabled framework
  const frameworks = getEnabledFrameworks();
  const endpoints = getBenchmarkableEndpoints();
  
  for (const fw of frameworks) {
    // PM2 commands
    commands[`pm2 ${fw.name}`] = {
      desc: `Start ${fw.displayName} with PM2 (port ${fw.port})`,
      cmd: `node pm2.js -start -f ${fw.name}`,
    };
    
    // Benchmark commands - auto-generate from ENDPOINTS
    for (const endpoint of endpoints) {
      // Create command key: "bench fastify" or "bench fastify code"
      const cmdKey = endpoint.shortName 
        ? `bench ${fw.name} ${endpoint.shortName}`
        : `bench ${fw.name}`;
      
      // Build bench.js command
      let benchCmd = `node bench.js -f ${fw.name}`;
      
      // Add endpoint path if not the default /simple
      if (endpoint.path !== '/simple') {
        benchCmd += ` -e ${endpoint.path}`;
      }
      
      // Add method if not GET
      if (endpoint.method !== 'GET') {
        benchCmd += ` -m ${endpoint.method}`;
      }
      
      commands[cmdKey] = {
        desc: `${fw.displayName}: ${endpoint.description}`,
        cmd: benchCmd,
      };
    }
  }
  
  return commands;
}

// Generate commands dynamically
const commands = generateCommands();

// Show help
function showHelp() {
  log("\n╔═══════════════════════════════════════════════════════════╗", "cyan");
  log("║                                                           ║", "cyan");
  log("║          🚀 NODE.JS 1M RPS - COMMAND LINE TOOL 🚀        ║", "cyan");
  log("║                                                           ║", "cyan");
  log("╚═══════════════════════════════════════════════════════════╝", "cyan");
  
  log("\nUsage: node rps.js <command>", "bold");
  log("   or: node rps.js <category> <action>\n", "bold");

  log("Quick Start:", "yellow");
  log("  start                    " + commands["start"].desc, "gray");
  log("  quickstart               " + commands["quickstart"].desc, "gray");
  log("  cleanup                  " + commands["cleanup"].desc, "gray");
  
  log("\nRedis Commands:", "yellow");
  log("  redis setup              " + commands["redis setup"].desc, "gray");
  log("  redis stop               " + commands["redis stop"].desc, "gray");
  log("  redis resume             " + commands["redis resume"].desc, "gray");
  log("  redis clean              " + commands["redis clean"].desc, "gray");
  log("  redis status             " + commands["redis status"].desc, "gray");
  
  log("\nPM2 Commands:", "yellow");
  const frameworks = getEnabledFrameworks();
  for (const fw of frameworks) {
    const cmdKey = `pm2 ${fw.name}`;
    const padding = " ".repeat(Math.max(0, 24 - cmdKey.length));
    log(`  ${cmdKey}${padding}${commands[cmdKey].desc}`, "gray");
  }
  log("  pm2 stop                 " + commands["pm2 stop"].desc, "gray");
  log("  pm2 restart              " + commands["pm2 restart"].desc, "gray");
  log("  pm2 delete               " + commands["pm2 delete"].desc, "gray");
  log("  pm2 logs                 " + commands["pm2 logs"].desc, "gray");
  log("  pm2 status               " + commands["pm2 status"].desc, "gray");
  
  log("\nBenchmarks:", "yellow");
  const endpoints = getBenchmarkableEndpoints();
  
  for (const fw of frameworks) {
    for (const endpoint of endpoints) {
      // Generate the same command key as in generateCommands()
      const cmdKey = endpoint.shortName 
        ? `bench ${fw.name} ${endpoint.shortName}`
        : `bench ${fw.name}`;
      
      const padding = " ".repeat(Math.max(0, 24 - cmdKey.length));
      log(`  ${cmdKey}${padding}${commands[cmdKey].desc}`, "gray");
    }
  }
  
  const firstFramework = frameworks[0]?.name || "fastify";
  log("\nExamples:", "yellow");
  log("  node rps.js start                  # Launch dashboard", "gray");
  log("  node rps.js redis setup            # Setup Redis cluster", "gray");
  log(`  node rps.js pm2 ${firstFramework.padEnd(14)} # Start ${frameworks[0]?.displayName || "framework"} with PM2`, "gray");
  log(`  node rps.js bench ${firstFramework.padEnd(12)} # Benchmark ${frameworks[0]?.displayName || "framework"}`, "gray");
  
  log("\n💡 Tip: Add to your PATH or create an alias:", "cyan");
  log("   alias rps='node /path/to/rps.js'", "gray");
  log("   Then use: rps start, rps redis setup, etc.\n", "gray");
}

// Execute command
function executeCommand(commandKey) {
  const command = commands[commandKey];
  
  if (!command) {
    log(`\n❌ Unknown command: ${commandKey}`, "red");
    log("Run 'node rps.js help' to see all commands\n", "gray");
    process.exit(1);
  }
  
  log(`\n▶ ${command.desc}`, "green");
  log(`→ ${command.cmd}\n`, "gray");
  
  const child = spawn(command.cmd, [], {
    shell: true,
    stdio: "inherit",
    cwd: __dirname,
  });
  
  child.on("exit", (code) => {
    if (code === 0) {
      log(`\n✓ Command completed successfully`, "green");
    } else if (code !== null) {
      log(`\n✗ Command exited with code ${code}`, "red");
    }
    process.exit(code || 0);
  });
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "help" || args[0] === "-h" || args[0] === "--help") {
  showHelp();
  process.exit(0);
}

// Join args to support multi-word commands like "redis setup"
const commandKey = args.join(" ");

executeCommand(commandKey);
