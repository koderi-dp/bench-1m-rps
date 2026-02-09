import pino from "pino";
import { createStream } from "rotating-file-stream";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");

// Ensure logs directory exists
const logsDir = join(projectRoot, "logs");
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

/**
 * Create rotating file stream for dashboard logs
 * Rotates daily or when file reaches 10MB
 */
const fileStream = createStream("dashboard.log", {
  path: logsDir,
  size: "10M", // Rotate every 10MB
  interval: "1d", // Rotate daily
  compress: "gzip", // Compress rotated files
  maxFiles: 30, // Keep 30 days of logs
});

/**
 * Observer pattern - UI widgets can subscribe to log events
 */
const observers = new Set();

/**
 * Subscribe to log events
 * @param {Function} callback - Called with (level, message, context)
 * @returns {Function} Unsubscribe function
 */
export function subscribe(callback) {
  observers.add(callback);
  return () => observers.delete(callback);
}

/**
 * Notify all observers of a log event
 */
function notifyObservers(level, message, context) {
  observers.forEach((callback) => {
    try {
      callback(level, message, context);
    } catch (error) {
      // Ignore observer errors to prevent logging loops
    }
  });
}

/**
 * Main dashboard logger instance
 * Logs to file via rotating file stream
 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      app: "node-1m-rps-dashboard",
    },
  },
  fileStream
);

// Also log to console if debug mode is enabled
if (process.env.DASHBOARD_DEBUG === "1") {
  console.log("[Logger] Debug mode enabled - logs will also appear on console");
}

/**
 * Generic info level logging with context
 * @param {string} message - Log message
 * @param {Object} context - Contextual metadata (service, controller, action, etc.)
 */
export function info(message, context = {}) {
  logger.info(context, message);
  notifyObservers("info", message, context);
}

/**
 * Generic debug level logging with context
 * @param {string} message - Log message
 * @param {Object} context - Contextual metadata (service, controller, action, etc.)
 */
export function debug(message, context = {}) {
  logger.debug(context, message);
  notifyObservers("debug", message, context);
}

/**
 * Generic error level logging with context
 * @param {string|Error} errorOrMessage - Error object or message
 * @param {Object} context - Contextual metadata (service, controller, action, etc.)
 */
export function error(errorOrMessage, context = {}) {
  const message = errorOrMessage instanceof Error ? errorOrMessage.message : errorOrMessage;
  
  if (errorOrMessage instanceof Error) {
    logger.error(
      {
        ...context,
        error: {
          message: errorOrMessage.message,
          stack: errorOrMessage.stack,
          code: errorOrMessage.code,
        },
      },
      message
    );
  } else {
    logger.error(context, errorOrMessage);
  }
  
  notifyObservers("error", message, context);
}

/**
 * Generic warn level logging with context
 * @param {string} message - Log message
 * @param {Object} context - Contextual metadata (service, controller, action, etc.)
 */
export function warn(message, context = {}) {
  logger.warn(context, message);
  notifyObservers("warn", message, context);
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context) {
  return logger.child(context);
}

/**
 * Flush logs and close streams (call on shutdown)
 */
export function closeLogger() {
  return new Promise((resolve) => {
    fileStream.end(() => {
      logger.flush();
      resolve();
    });
  });
}

export default logger;
