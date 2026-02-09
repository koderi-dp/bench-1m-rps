#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

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

// Command definitions
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

  // PM2 commands
  "pm2 cpeak": {
    desc: "Start Cpeak with PM2 (port 3000)",
    cmd: "node pm2.js -start -f cpeak",
  },
  "pm2 express": {
    desc: "Start Express with PM2 (port 3001)",
    cmd: "node pm2.js -start -f express",
  },
  "pm2 fastify": {
    desc: "Start Fastify with PM2 (port 3002)",
    cmd: "node pm2.js -start -f fastify",
  },
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

  // Dev servers
  "dev cpeak": {
    desc: "Run Cpeak in dev mode (port 3000)",
    cmd: "node cpeak.js",
  },
  "dev express": {
    desc: "Run Express in dev mode (port 3001)",
    cmd: "node express.js",
  },
  "dev fastify": {
    desc: "Run Fastify in dev mode (port 3002)",
    cmd: "node fastify.js",
  },

  // Benchmarks
  "bench cpeak": {
    desc: "Benchmark Cpeak GET /simple",
    cmd: "node bench.js -f cpeak",
  },
  "bench cpeak code": {
    desc: "Benchmark Cpeak POST /code",
    cmd: "node bench.js -f cpeak -e /code -m POST",
  },
  "bench cpeak read": {
    desc: "Benchmark Cpeak GET /code-fast",
    cmd: "node bench.js -f cpeak -e /code-fast",
  },
  "bench express": {
    desc: "Benchmark Express GET /simple",
    cmd: "node bench.js -f express",
  },
  "bench express code": {
    desc: "Benchmark Express POST /code",
    cmd: "node bench.js -f express -e /code -m POST",
  },
  "bench express read": {
    desc: "Benchmark Express GET /code-fast",
    cmd: "node bench.js -f express -e /code-fast",
  },
  "bench fastify": {
    desc: "Benchmark Fastify GET /simple",
    cmd: "node bench.js -f fastify",
  },
};

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
  log("  pm2 cpeak                " + commands["pm2 cpeak"].desc, "gray");
  log("  pm2 express              " + commands["pm2 express"].desc, "gray");
  log("  pm2 fastify              " + commands["pm2 fastify"].desc, "gray");
  log("  pm2 stop                 " + commands["pm2 stop"].desc, "gray");
  log("  pm2 restart              " + commands["pm2 restart"].desc, "gray");
  log("  pm2 delete               " + commands["pm2 delete"].desc, "gray");
  log("  pm2 logs                 " + commands["pm2 logs"].desc, "gray");
  log("  pm2 status               " + commands["pm2 status"].desc, "gray");
  
  log("\nDev Servers:", "yellow");
  log("  dev cpeak                " + commands["dev cpeak"].desc, "gray");
  log("  dev express              " + commands["dev express"].desc, "gray");
  log("  dev fastify              " + commands["dev fastify"].desc, "gray");
  
  log("\nBenchmarks:", "yellow");
  log("  bench cpeak              " + commands["bench cpeak"].desc, "gray");
  log("  bench cpeak code         " + commands["bench cpeak code"].desc, "gray");
  log("  bench cpeak read         " + commands["bench cpeak read"].desc, "gray");
  log("  bench express            " + commands["bench express"].desc, "gray");
  log("  bench express code       " + commands["bench express code"].desc, "gray");
  log("  bench express read       " + commands["bench express read"].desc, "gray");
  log("  bench fastify            " + commands["bench fastify"].desc, "gray");
  
  log("\nExamples:", "yellow");
  log("  node rps.js start                  # Launch dashboard", "gray");
  log("  node rps.js redis setup            # Setup Redis cluster", "gray");
  log("  node rps.js pm2 express            # Start Express with PM2", "gray");
  log("  node rps.js bench express          # Benchmark Express", "gray");
  
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
