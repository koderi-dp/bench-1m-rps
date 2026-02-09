import { exec } from "child_process";
import { promisify } from "util";
import { TIMEOUTS, BUFFERS } from "../config/constants.js";

/**
 * Promisified exec for async/await usage
 */
export const execAsync = promisify(exec);

/**
 * Execute a shell command with enhanced options
 * @param {string} command - The command to execute
 * @param {object} options - Additional options
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execCommand(command, options = {}) {
  const defaultOptions = {
    maxBuffer: options.maxBuffer || BUFFERS.commandOutput,
    timeout: options.timeout || TIMEOUTS.command,
    encoding: 'utf-8'
  };

  return execAsync(command, { ...defaultOptions, ...options });
}

/**
 * Execute PM2 command with appropriate buffer size
 * @param {string} command - The PM2 command
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execPM2Command(command) {
  return execCommand(command, {
    maxBuffer: BUFFERS.pm2Output,
    timeout: TIMEOUTS.pm2Stats
  });
}

/**
 * Execute Redis command with timeout
 * @param {string} command - The Redis CLI command
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function execRedisCommand(command) {
  return execCommand(command, {
    timeout: TIMEOUTS.redisStats
  });
}
