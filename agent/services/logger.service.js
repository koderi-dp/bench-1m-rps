import pino from "pino";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const agentRoot = join(__dirname, "..");

// Ensure logs directory exists in agent folder
const logsDir = join(agentRoot, "logs");
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

const isDev = process.env.NODE_ENV === "development";

/**
 * Redis Agent Logger
 * - Development: pretty-printed to stdout
 * - Production: JSON to stdout (for log aggregation)
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    app: "node-1m-rps-redis-agent",
  },
});

/**
 * Info level logging
 */
export function info(message, context = {}) {
  logger.info(context, message);
}

/**
 * Debug level logging
 */
export function debug(message, context = {}) {
  logger.debug(context, message);
}

/**
 * Error level logging
 */
export function error(errorOrMessage, context = {}) {
  const message =
    errorOrMessage instanceof Error ? errorOrMessage.message : errorOrMessage;

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
}

/**
 * Warn level logging
 */
export function warn(message, context = {}) {
  logger.warn(context, message);
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context) {
  return logger.child(context);
}

/**
 * High-frequency polling endpoints that should use debug level
 */
const DEBUG_PATHS = new Set([
  "/api/redis/stats",
  "/api/redis/nodes",
  "/health",
]);

/**
 * Express request logging middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const isDebugPath = DEBUG_PATHS.has(req.path);
    
    // Use debug for high-frequency polling, warn for errors, info for rest
    let level;
    if (res.statusCode >= 400) {
      level = "warn";
    } else if (isDebugPath) {
      level = "debug";
    } else {
      level = "info";
    }

    logger[level](
      {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
      },
      `${req.method} ${req.path} ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}

export default logger;
