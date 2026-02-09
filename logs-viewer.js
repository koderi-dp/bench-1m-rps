#!/usr/bin/env node

/**
 * Dashboard Log Viewer
 * Usage:
 *   node logs-viewer.js [options]
 * 
 * Options:
 *   --tail, -t <n>       Show last N lines (default: 50)
 *   --follow, -f         Follow log file (like tail -f)
 *   --filter <event>     Filter by event type
 *   --level <level>      Filter by log level (INFO, ERROR, DEBUG)
 *   --today              Show only today's logs
 *   --pretty             Pretty print JSON logs
 */

import { readFileSync, createReadStream, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOG_FILE = join(__dirname, "logs", "dashboard.log");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  tail: 50,
  follow: false,
  filter: null,
  level: null,
  today: false,
  pretty: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--tail" || arg === "-t") {
    options.tail = parseInt(args[++i]) || 50;
  } else if (arg === "--follow" || arg === "-f") {
    options.follow = true;
  } else if (arg === "--filter") {
    options.filter = args[++i];
  } else if (arg === "--level") {
    options.level = args[++i].toUpperCase();
  } else if (arg === "--today") {
    options.today = true;
  } else if (arg === "--pretty") {
    options.pretty = true;
  } else if (arg === "--help" || arg === "-h") {
    console.log(`
Dashboard Log Viewer

Usage: node logs-viewer.js [options]

Options:
  --tail, -t <n>       Show last N lines (default: 50)
  --follow, -f         Follow log file (like tail -f)
  --filter <event>     Filter by event type (e.g., command_execute, error)
  --level <level>      Filter by log level (INFO, ERROR, DEBUG)
  --today              Show only today's logs
  --pretty             Pretty print JSON logs

Examples:
  node logs-viewer.js --tail 100
  node logs-viewer.js --follow --filter command_execute
  node logs-viewer.js --level ERROR --today
  node logs-viewer.js --pretty --tail 20
`);
    process.exit(0);
  }
}

/**
 * Format a log entry
 */
function formatLog(line, pretty = false) {
  try {
    const log = JSON.parse(line);

    // Apply filters
    if (options.level && log.level !== options.level) {
      return null;
    }
    if (options.filter && log.event !== options.filter) {
      return null;
    }
    if (options.today) {
      const today = new Date().toISOString().split("T")[0];
      const logDate = log.time.split("T")[0];
      if (logDate !== today) {
        return null;
      }
    }

    if (pretty) {
      const time = new Date(log.time).toLocaleTimeString();
      const level = log.level.padEnd(5);
      let output = `[${time}] ${level} ${log.msg}`;
      
      // Add event type if present
      if (log.event) {
        output += ` (${log.event})`;
      }
      
      // Add additional context
      const exclude = ["level", "time", "msg", "event", "app", "pid", "hostname"];
      const extra = Object.keys(log)
        .filter((k) => !exclude.includes(k))
        .map((k) => {
          const value = typeof log[k] === "object" ? JSON.stringify(log[k]) : log[k];
          return `${k}=${value}`;
        });
      
      if (extra.length > 0) {
        output += `\n    ${extra.join(", ")}`;
      }
      
      return output;
    }

    return line;
  } catch (e) {
    return line;
  }
}

/**
 * Read and display logs
 */
function displayLogs() {
  try {
    const content = readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.trim());

    // Get last N lines
    const startIndex = Math.max(0, lines.length - options.tail);
    const displayLines = lines.slice(startIndex);

    displayLines.forEach((line) => {
      const formatted = formatLog(line, options.pretty);
      if (formatted) {
        console.log(formatted);
      }
    });

    return lines.length;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error("No log file found. Start the dashboard to create logs.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Follow log file
 */
function followLogs() {
  let lastSize = statSync(LOG_FILE).size;
  let buffer = "";

  setInterval(() => {
    const currentSize = statSync(LOG_FILE).size;

    if (currentSize > lastSize) {
      const stream = createReadStream(LOG_FILE, {
        start: lastSize,
        end: currentSize,
      });

      stream.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Keep incomplete line in buffer

        lines.forEach((line) => {
          if (line.trim()) {
            const formatted = formatLog(line, options.pretty);
            if (formatted) {
              console.log(formatted);
            }
          }
        });
      });

      lastSize = currentSize;
    }
  }, 500);
}

// Main execution
console.log("=".repeat(80));
console.log("Dashboard Logs");
console.log("=".repeat(80));

const lineCount = displayLogs();

if (options.follow) {
  console.log("\nFollowing log file... (Ctrl-C to stop)");
  followLogs();
} else {
  console.log(`\nShowing ${Math.min(options.tail, lineCount)} of ${lineCount} total lines`);
  console.log(`Log file: ${LOG_FILE}`);
}
