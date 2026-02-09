#!/usr/bin/env node

import { spawn, exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import readline from "readline";

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
  bold: "\x1b[1m",
};

function log(msg, color = "reset") {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Ask user for confirmation
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Check if PM2 is installed
async function checkPM2Installation() {
  try {
    await execAsync("pm2 --version");
    return true;
  } catch (error) {
    log("\n❌ PM2 is not installed!", "red");
    log("\nInstall PM2 globally:", "yellow");
    log("  npm install -g pm2", "gray");
    log("  or use: npx pm2 <command>\n", "gray");
    return false;
  }
}

// Get PM2 process list
async function getPM2Processes() {
  try {
    const { stdout } = await execAsync("pm2 jlist");
    return JSON.parse(stdout);
  } catch (error) {
    return [];
  }
}

// Detect running frameworks
async function detectFrameworks() {
  const processes = await getPM2Processes();
  const frameworks = {
    cpeak: processes.filter(p => p.name === "cpeak"),
    express: processes.filter(p => p.name === "express"),
    fastify: processes.filter(p => p.name === "fastify"),
  };
  return frameworks;
}

// Parse arguments
const args = process.argv.slice(2);
let command = "";
let framework = null; // null = all frameworks
let instances = 6;
let action = "";
let needsConfirmation = false;
let forceMode = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case "-start":
    case "-stop":
    case "-restart":
    case "-delete":
    case "-status":
    case "-logs":
    case "-monit":
      command = arg.substring(1); // remove dash
      break;
    case "-f":
    case "--framework":
      framework = args[++i];
      if (!["cpeak", "express", "fastify"].includes(framework)) {
        log(`Invalid framework: ${framework}`, "red");
        log("Valid options: cpeak, express, fastify", "gray");
        process.exit(1);
      }
      break;
    case "-i":
    case "--instances":
      instances = parseInt(args[++i]);
      if (isNaN(instances) || instances < 1) {
        log("Invalid instance count. Must be >= 1", "red");
        process.exit(1);
      }
      if (instances > 100) {
        needsConfirmation = true;
      }
      break;
    case "--force":
    case "--yes":
      forceMode = true;
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
  log("║          PM2 Process Manager - CLI Wrapper               ║", "cyan");
  log("╚═══════════════════════════════════════════════════════════╝", "cyan");
  
  log("\nUsage: node pm2.js <command> [options]", "bold");
  
  log("\nCommands:", "yellow");
  log("  -start      Start server(s) with PM2");
  log("  -stop       Stop running server(s)");
  log("  -restart    Restart running server(s)");
  log("  -delete     Delete server(s) from PM2");
  log("  -status     Show PM2 process status");
  log("  -logs       View PM2 logs (live)");
  log("  -monit      Open PM2 monitoring dashboard");
  
  log("\nOptions:", "yellow");
  log("  -f, --framework <name>   Specify framework: cpeak, express, fastify");
  log("                           (default: all frameworks if omitted)");
  log("  -i, --instances <num>    Number of instances (default: 6)");
  log("                           ⚠️  Values >100 require confirmation");
  log("  --force, --yes           Skip confirmation prompts (use with caution!)");
  log("  -h, --help               Show this help message");
  
  log("\nExamples:", "yellow");
  log("  node pm2.js -start -f express            # Start Express with 6 instances", "gray");
  log("  node pm2.js -start -f cpeak -i 8         # Start Cpeak with 8 instances", "gray");
  log("  node pm2.js -stop -f express             # Stop Express", "gray");
  log("  node pm2.js -restart                     # Restart all frameworks", "gray");
  log("  node pm2.js -delete                      # Delete all processes", "gray");
  log("  node pm2.js -status                      # Show process status", "gray");
  log("  node pm2.js -logs -f express             # View Express logs", "gray");
  
  log("\nFrameworks:", "yellow");
  log("  cpeak    - High-performance HTTP server (port 3000)", "gray");
  log("  express  - Express.js server (port 3001)", "gray");
  log("  fastify  - Fastify server (port 3002)", "gray");
  
  log("\n");
}

// Execute PM2 command
function runCommand(cmd, description) {
  return new Promise((resolve, reject) => {
    log(`\n▶ ${description}`, "cyan");
    log(`→ ${cmd}`, "gray");
    
    const child = spawn(cmd, [], {
      shell: true,
      stdio: "inherit",
      cwd: __dirname,
      env: process.env,
    });
    
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    child.on("error", (err) => {
      reject(err);
    });
  });
}

// Start framework
async function startFramework(fw, inst) {
  const configFile = "ecosystem.config.cjs";
  
  if (!existsSync(join(__dirname, configFile))) {
    log(`\n❌ Config file not found: ${configFile}`, "red");
    return false;
  }
  
  // Check if already running
  const processes = await getPM2Processes();
  const existing = processes.find(p => p.name === fw);
  
  if (existing) {
    log(`\n⚠️  ${fw} is already running with ${existing.pm2_env.instances || 1} instance(s)`, "yellow");
    log("Use -restart to restart or -stop then -start to change instances", "gray");
    return false;
  }
  
  const cmd = `F=${fw} I=${inst} pm2 start ${configFile} --update-env`;
  const description = `Starting ${fw} with ${inst} instances (port ${getPort(fw)})`;
  
  try {
    await runCommand(cmd, description);
    log(`\n✓ ${fw} started successfully`, "green");
    return true;
  } catch (error) {
    log(`\n✗ Failed to start ${fw}`, "red");
    return false;
  }
}

// Stop framework
async function stopFramework(fw) {
  const processes = await getPM2Processes();
  const existing = processes.find(p => p.name === fw);
  
  if (!existing) {
    log(`\n⚠️  ${fw} is not running`, "yellow");
    return false;
  }
  
  const cmd = `pm2 stop ${fw}`;
  const description = `Stopping ${fw}`;
  
  try {
    await runCommand(cmd, description);
    log(`\n✓ ${fw} stopped successfully`, "green");
    return true;
  } catch (error) {
    log(`\n✗ Failed to stop ${fw}`, "red");
    return false;
  }
}

// Restart framework
async function restartFramework(fw) {
  const processes = await getPM2Processes();
  const existing = processes.find(p => p.name === fw);
  
  if (!existing) {
    log(`\n⚠️  ${fw} is not running. Use -start instead`, "yellow");
    return false;
  }
  
  const cmd = `pm2 restart ${fw}`;
  const description = `Restarting ${fw}`;
  
  try {
    await runCommand(cmd, description);
    log(`\n✓ ${fw} restarted successfully`, "green");
    return true;
  } catch (error) {
    log(`\n✗ Failed to restart ${fw}`, "red");
    return false;
  }
}

// Delete framework
async function deleteFramework(fw) {
  const processes = await getPM2Processes();
  const existing = processes.find(p => p.name === fw);
  
  if (!existing) {
    log(`\n⚠️  ${fw} is not in PM2`, "yellow");
    return false;
  }
  
  const cmd = `pm2 delete ${fw}`;
  const description = `Deleting ${fw} from PM2`;
  
  try {
    await runCommand(cmd, description);
    log(`\n✓ ${fw} deleted successfully`, "green");
    return true;
  } catch (error) {
    log(`\n✗ Failed to delete ${fw}`, "red");
    return false;
  }
}

// Show status
async function showStatus() {
  log("\n╔═══════════════════════════════════════════════════════════╗", "cyan");
  log("║                  PM2 Process Status                       ║", "cyan");
  log("╚═══════════════════════════════════════════════════════════╝", "cyan");
  
  const cmd = "pm2 status";
  
  try {
    await runCommand(cmd, "Fetching PM2 process list");
  } catch (error) {
    log("\n✗ Failed to get status", "red");
  }
}

// View logs
async function viewLogs(fw) {
  const target = fw || "all";
  const cmd = fw ? `pm2 logs ${fw}` : "pm2 logs";
  const description = `Viewing logs for ${target}`;
  
  log("\n💡 Press Ctrl+C to exit logs view\n", "cyan");
  
  try {
    await runCommand(cmd, description);
  } catch (error) {
    // Ctrl+C is expected, don't show error
  }
}

// Open monitoring
async function openMonit() {
  const cmd = "pm2 monit";
  const description = "Opening PM2 monitoring dashboard";
  
  log("\n💡 Press 'q' to exit monitoring view\n", "cyan");
  
  try {
    await runCommand(cmd, description);
  } catch (error) {
    // Exit is expected, don't show error
  }
}

// Get port for framework
function getPort(fw) {
  const ports = {
    cpeak: 3000,
    express: 3001,
    fastify: 3002,
  };
  return ports[fw] || "unknown";
}

// Stop all frameworks
async function stopAll() {
  const frameworks = await detectFrameworks();
  const running = Object.keys(frameworks).filter(fw => frameworks[fw].length > 0);
  
  if (running.length === 0) {
    log("\n⚠️  No frameworks are running", "yellow");
    return;
  }
  
  const cmd = "pm2 stop all";
  const description = `Stopping all frameworks (${running.join(", ")})`;
  
  try {
    await runCommand(cmd, description);
    log(`\n✓ All frameworks stopped`, "green");
  } catch (error) {
    log(`\n✗ Failed to stop all frameworks`, "red");
  }
}

// Restart all frameworks
async function restartAll() {
  const frameworks = await detectFrameworks();
  const running = Object.keys(frameworks).filter(fw => frameworks[fw].length > 0);
  
  if (running.length === 0) {
    log("\n⚠️  No frameworks are running", "yellow");
    return;
  }
  
  const cmd = "pm2 restart all";
  const description = `Restarting all frameworks (${running.join(", ")})`;
  
  try {
    await runCommand(cmd, description);
    log(`\n✓ All frameworks restarted`, "green");
  } catch (error) {
    log(`\n✗ Failed to restart all frameworks`, "red");
  }
}

// Delete all frameworks
async function deleteAll() {
  const frameworks = await detectFrameworks();
  const existing = Object.keys(frameworks).filter(fw => frameworks[fw].length > 0);
  
  if (existing.length === 0) {
    log("\n⚠️  No frameworks in PM2", "yellow");
    return;
  }
  
  const cmd = "pm2 delete all";
  const description = `Deleting all frameworks (${existing.join(", ")})`;
  
  try {
    await runCommand(cmd, description);
    log(`\n✓ All frameworks deleted`, "green");
  } catch (error) {
    log(`\n✗ Failed to delete all frameworks`, "red");
  }
}

// Update ecosystem config with instance count
function updateEcosystemConfig(fw, inst) {
  const configPath = join(__dirname, "ecosystem.config.cjs");
  const content = `module.exports = {
  apps: [
    {
      name: process.env.F || "cpeak",
      script: \`./\${process.env.F || "cpeak"}.js\`,
      instances: ${inst},
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        REDIS_CLUSTER: "true",
      },
    },
  ],
};
`;
  
  try {
    writeFileSync(configPath, content, "utf-8");
    return true;
  } catch (error) {
    log(`\n❌ Failed to update config: ${error.message}`, "red");
    return false;
  }
}

// Main execution
async function main() {
  // Show usage if no command
  if (!command) {
    showUsage();
    process.exit(0);
  }
  
  // Check for dangerous instance count
  if (needsConfirmation && command === "start" && !forceMode) {
    log("\n⚠️  WARNING: You're trying to start more than 100 instances!", "red");
    log(`Requested: ${instances} instances`, "yellow");
    log("\nThis could crash your system!", "red");
    log("Recommended maximum: 50 instances", "yellow");
    log("Typical usage: 6-20 instances\n", "gray");
    
    const answer = await askConfirmation("Type 'yes' to continue anyway: ");
    
    if (answer.toLowerCase() !== 'yes') {
      log("\n✓ Cancelled. Your system is safe.", "green");
      process.exit(0);
    }
    log("\n⚠️  Proceeding with caution...\n", "yellow");
  }
  
  // Check PM2 installation
  const hasPM2 = await checkPM2Installation();
  if (!hasPM2) {
    process.exit(1);
  }
  
  // Execute command
  try {
    switch (command) {
      case "start":
        if (framework) {
          await startFramework(framework, instances);
        } else {
          log("\n⚠️  Please specify a framework with -f", "yellow");
          log("Example: node pm2.js -start -f express", "gray");
          log("\nAvailable frameworks: cpeak, express, fastify\n", "gray");
        }
        break;
        
      case "stop":
        if (framework) {
          await stopFramework(framework);
        } else {
          await stopAll();
        }
        break;
        
      case "restart":
        if (framework) {
          await restartFramework(framework);
        } else {
          await restartAll();
        }
        break;
        
      case "delete":
        if (framework) {
          await deleteFramework(framework);
        } else {
          await deleteAll();
        }
        break;
        
      case "status":
        await showStatus();
        break;
        
      case "logs":
        await viewLogs(framework);
        break;
        
      case "monit":
        await openMonit();
        break;
        
      default:
        log(`\n❌ Unknown command: ${command}`, "red");
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, "red");
    process.exit(1);
  }
}

main();
