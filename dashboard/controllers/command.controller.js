import { stripAnsi } from "../utils/format.js";
import { formatNumber } from "../utils/format.js";
import { execAsync } from "../utils/exec.js";
import { info as logInfo, error as logError } from "../services/logger.service.js";

/**
 * CommandController - Executes shell commands and parses output
 */
export class CommandController {
  constructor(updateController, redisService = null, benchmarkService = null) {
    this.updateController = updateController;
    this.redisService = redisService;
    this.benchmarkService = benchmarkService;
  }

  /**
   * Execute a shell command and parse output
   * @param {string} command - The command to execute
   * @param {string} label - Human-readable label for logging
   */
  async execute(command, label) {
    const startTime = Date.now();
    
    // Check if this is a Redis command and invalidate cache before execution
    const isRedisCommand = command.includes("redis.js") || command.includes("redis");
    if (isRedisCommand && this.redisService) {
      this.redisService.invalidateCache();
    }
    
    // Log command start
    logInfo(`Command started: ${label}`, {
      source: "controller",
      controller: "command",
      action: "execute",
      command,
      label,
      status: "started",
    });
    
    // Show immediate feedback for long-running commands (benchmarks)
    if (command.includes("bench.js")) {
      const frameworkMatch = command.match(/-f (\w+)/);
      if (frameworkMatch) {
        logInfo(`Running ${frameworkMatch[1]} benchmark...`, {
          source: "controller",
          controller: "command",
          action: "benchmark_start",
          framework: frameworkMatch[1],
        });
      } else {
        logInfo(`${label}...`, {
          source: "controller",
          controller: "command",
          action: "command_start",
        });
      }
    }

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      let message = null;

      // Parse and show meaningful output
      if (stdout) {
        const cleanOutput = stripAnsi(stdout.trim());
        message = this.parseOutput(cleanOutput, command);

        // Check if benchmark completed and refresh summary
        if (cleanOutput.includes("BENCHMARK_RESULT:")) {
          // Force reload benchmark history from disk (bench.js runs in separate process)
          if (this.benchmarkService) {
            await this.benchmarkService.reload();
          }
          await this.updateController.updateBenchmark();
        }
      }

      // Show stderr only if it's an actual error (not PM2 warnings)
      if (stderr) {
        const cleanStderr = stripAnsi(stderr.trim());
        if (
          cleanStderr &&
          !cleanStderr.includes("[WARN]") &&
          !cleanStderr.includes("[PM2]")
        ) {
          logInfo(cleanStderr.split("\n")[0].substring(0, 60), {
            source: "controller",
            controller: "command",
            action: "execute",
            type: "stderr_warning",
          });
        }
      }

      // Log success
      const duration = Date.now() - startTime;
      logInfo(`Command succeeded: ${label}`, {
        source: "controller",
        controller: "command",
        action: "execute",
        command,
        label,
        status: "success",
        duration_ms: duration,
        message: message || "completed",
      });

      // Refresh dashboard after command
      setTimeout(() => this.updateController.updateAll(), 1000);
    } catch (err) {
      const duration = Date.now() - startTime;
      
      // When a command exits with non-zero code, check if stdout has validation messages
      if (err.stdout) {
        const cleanOutput = stripAnsi(err.stdout.trim());

        // Check for benchmark validation errors
        if (cleanOutput.includes("Benchmark cancelled")) {
          if (cleanOutput.includes("is not running")) {
            const fwMatch = cleanOutput.match(/❌ (\w+) is not running/);
            const currentMatch = cleanOutput.match(/Currently running: (\w+)/);
            if (fwMatch && currentMatch) {
              const msg = `Cannot benchmark ${fwMatch[1]} - ${currentMatch[1]} is running instead`;
              logError(msg, {
                source: "controller",
                controller: "command",
                action: "execute",
                command,
                label,
                status: "failed",
                duration_ms: duration,
                reason: "validation_error",
              });
              return;
            } else if (fwMatch) {
              const msg = `Cannot benchmark ${fwMatch[1]} - not running in PM2`;
              logError(msg, {
                source: "controller",
                controller: "command",
                action: "execute",
                command,
                label,
                status: "failed",
                duration_ms: duration,
                reason: "validation_error",
              });
              return;
            }
          } else if (cleanOutput.includes("No PM2 processes")) {
            const msg = "No PM2 processes running - start a framework first";
            logError(msg, {
              source: "controller",
              controller: "command",
              action: "execute",
              command,
              label,
              status: "failed",
              duration_ms: duration,
              reason: "validation_error",
            });
            return;
          }
          logError("Benchmark validation failed", {
            source: "controller",
            controller: "command",
            action: "execute",
            command,
            label,
            status: "failed",
            duration_ms: duration,
            reason: "validation_error",
          });
          return;
        }
      }

      // Generic error handling
      logError(err, {
        source: "controller",
        controller: "command",
        action: "execute",
        command,
        label,
        status: "failed",
        duration_ms: duration,
      });
    }
  }

  /**
   * Parse command output and extract meaningful information
   * @param {string} cleanOutput - Output with ANSI codes stripped
   * @param {string} command - Original command
   * @returns {string|null} Parsed message or null
   */
  parseOutput(cleanOutput, command) {
    // PM2 commands
    if (cleanOutput.includes("started successfully")) {
      const match = cleanOutput.match(/✓ (\w+) started successfully/);
      if (match) return `✓ Started ${match[1]}`;
    } else if (cleanOutput.includes("stopped successfully")) {
      const match = cleanOutput.match(/✓ (\w+) stopped successfully/);
      if (match) return `✓ Stopped ${match[1]}`;
    } else if (cleanOutput.includes("All frameworks stopped")) {
      return "✓ Stopped all PM2 processes";
    } else if (cleanOutput.includes("All frameworks deleted")) {
      return "✓ Deleted all PM2 processes";
    } else if (cleanOutput.includes("restarted successfully")) {
      const match = cleanOutput.match(/✓ (\w+) restarted successfully/);
      if (match) return `✓ Restarted ${match[1]}`;
    } else if (cleanOutput.includes("All frameworks restarted")) {
      return "✓ Restarted all PM2 processes";
    } else if (cleanOutput.includes("launched")) {
      // Extract instance count from PM2 output
      const match = cleanOutput.match(/App \[(\w+)\] launched \((\d+) instances?\)/);
      if (match) return `✓ ${match[1]}: ${match[2]} instances`;
    }

    // Redis commands
    if (cleanOutput.includes("Redis Cluster") && cleanOutput.includes("ready")) {
      return "✓ Redis cluster ready";
    }

    // Status command - count online instances
    if (cleanOutput.match(/online/)) {
      const onlineCount = (cleanOutput.match(/online/g) || []).length;
      if (onlineCount > 0) return `${onlineCount} processes online`;
    }

    // Benchmark results
    if (cleanOutput.includes("BENCHMARK_RESULT:")) {
      // Parse benchmark results: BENCHMARK_RESULT:framework:reqPerSec:avgLatency:totalReqs
      const match = cleanOutput.match(/BENCHMARK_RESULT:(\w+):(\d+):([0-9.]+):(\d+)/);
      if (match) {
        const [, fw, rps, latency, total] = match;
        const formattedRps = formatNumber(parseInt(rps));
        const formattedTotal = formatNumber(parseInt(total));
        return `✓ Benchmark ${fw}: ${formattedRps} req/s (${latency}ms avg, ${formattedTotal} total)`;
      }
    }

    return null;
  }
}
