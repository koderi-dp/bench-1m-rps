#!/usr/bin/env node

import { spawn, exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import {
  isValidFramework,
  getFrameworkNames,
  getFrameworkPort,
  getFramework,
  getEnabledFrameworks,
  CONFIG
} from "../config/frameworks.config.js";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");
const ecosystemConfigPath = join(projectRoot, "api/config/ecosystem.config.cjs");

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

// Detect running frameworks (dynamic - works with any framework from config)
async function detectFrameworks() {
  const processes = await getPM2Processes();
  const frameworks = {};
  
  // Build dynamic object with all enabled frameworks from config
  for (const fw of getEnabledFrameworks()) {
    frameworks[fw.name] = processes.filter(p => p.name === fw.name);
  }
  
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
      if (!isValidFramework(framework)) {
        log(`Invalid framework: ${framework}`, "red");
        log(`Valid options: ${getFrameworkNames().join(", ")}`, "gray");
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
  log(`  -f, --framework <name>   Specify framework: ${getFrameworkNames().join(", ")}`);
  log("                           (default: all frameworks if omitted)");
  log("  -i, --instances <num>    Number of instances (default: 6)");
  log("                           ⚠️  Values >100 require confirmation");
  log("  --force, --yes           Skip confirmation prompts (use with caution!)");
  log("  -h, --help               Show this help message");
  
  log("\nExamples:", "yellow");
  const frameworks = getFrameworkNames();
  log(`  node pm2.js -start -f ${frameworks[1]}            # Start ${frameworks[1]} with 6 instances`, "gray");
  log(`  node pm2.js -start -f ${frameworks[0]} -i 8         # Start ${frameworks[0]} with 8 instances`, "gray");
  log(`  node pm2.js -stop -f ${frameworks[1]}             # Stop ${frameworks[1]}`, "gray");
  log("  node pm2.js -restart                     # Restart all frameworks", "gray");
  log("  node pm2.js -delete                      # Delete all processes", "gray");
  log("  node pm2.js -status                      # Show process status", "gray");
  log(`  node pm2.js -logs -f ${frameworks[1]}             # View ${frameworks[1]} logs`, "gray");
  
  log("\nFrameworks:", "yellow");
  for (const fw of getEnabledFrameworks()) {
    const fwConfig = getFramework(fw.name);
    log(`  ${fwConfig.name.padEnd(8)} - ${fwConfig.displayName} server (port ${fwConfig.port})`, "gray");
  }
  
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
      cwd: projectRoot,
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
  const configFile = ecosystemConfigPath;
  
  // Get framework config to determine runtime and script path
  const fwConfig = getFramework(fw);
  if (!fwConfig) {
    log(`\n❌ Framework not found: ${fw}`, "red");
    return false;
  }
  
  if (!existsSync(configFile)) {
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
  
  // Get all settings from framework config (100% dynamic!)
  const interpreter = fwConfig.interpreterPath || fwConfig.interpreter || 'node';
  const runtime = fwConfig.runtime || 'node';
  const execMode = fwConfig.execMode || 'cluster';
  const reusePort = fwConfig.reusePort || false;
  const defaultInstances = fwConfig.instances || 1;
  
  // Use framework's default instances if not specified by user
  const actualInstances = inst || defaultInstances;
  
  // Warn if trying to use multiple instances in fork mode WITHOUT reusePort
  if (execMode === 'fork' && actualInstances > 1 && !reusePort) {
    log(`\n⚠️  Note: ${fw} uses PM2 fork mode (single process)`, "yellow");
    log(`   Starting 1 instance instead of ${actualInstances}.`, "gray");
    log(`   Fork mode is configured in frameworks.config.js`, "gray");
    log(`   Tip: Add reusePort: true if the runtime supports SO_REUSEPORT`, "gray");
  }
  
  // Build PM2 command with all config passed via environment variables
  const reusePortEnv = reusePort ? `REUSE_PORT=true` : `REUSE_PORT=false`;
  const scriptPath = join(projectRoot, fwConfig.file);
  const cmd = `F=${fw} I=${actualInstances} SCRIPT="${scriptPath}" INTERPRETER="${interpreter}" EXEC_MODE=${execMode} ${reusePortEnv} pm2 start "${configFile}" --update-env`;
  
  // Calculate actual instance count for display
  const effectiveInstances = (execMode === 'fork' && !reusePort) ? 1 : actualInstances;
  const modeText = execMode === 'fork' 
    ? (reusePort ? 'fork + reusePort' : 'fork (single process)')
    : 'cluster';
  const description = `Starting ${fw} (${runtime}) with ${effectiveInstances} instances (port ${fwConfig.port})`;
  
  try {
    await runCommand(cmd, description);
    log(`\n✓ ${fw} started successfully`, "green");
    log(`   Runtime: ${runtime}`, "gray");
    log(`   Mode: ${modeText}`, "gray");
    log(`   Instances: ${effectiveInstances}`, "gray");
    if (reusePort) log(`   Port sharing: SO_REUSEPORT (Linux)`, "gray");
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
  return getFrameworkPort(fw) || "unknown";
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
// NOTE: This function is deprecated - ecosystem.config.cjs is now 100% dynamic
// Keeping for backwards compatibility but not used anymore
function updateEcosystemConfig(fw, inst) {
  const configPath = join(__dirname, "ecosystem.config.cjs");
  const fwConfig = getFramework(fw);
  const defaultFw = CONFIG.defaultFramework;
  
  const content = `module.exports = {
  apps: [
    {
      name: process.env.F || "${defaultFw}",
      script: process.env.SCRIPT || "./frameworks/nodejs/${defaultFw}.js",
      interpreter: process.env.INTERPRETER || "node",
      instances: ${inst},
      exec_mode: process.env.EXEC_MODE || "cluster",
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
          const exampleFw = getFrameworkNames()[0];
          log(`Example: node pm2.js -start -f ${exampleFw}`, "gray");
          log(`\nAvailable frameworks: ${getFrameworkNames().join(", ")}\n`, "gray");
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
