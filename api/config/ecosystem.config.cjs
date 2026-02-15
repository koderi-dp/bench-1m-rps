/**
 * PM2 Ecosystem Configuration (Framework-Agnostic)
 * 
 * This config is 100% dynamic and works with ANY runtime:
 * Node.js, Bun, C# (.NET), Go, Rust, Python, etc.
 * 
 * All framework-specific settings come from frameworks.config.js via environment variables.
 * To add a new runtime, simply update frameworks.config.js - no changes needed here!
 * 
 * Environment variables set by pm2.js:
 * - F: Framework name
 * - I: Number of instances (for cluster mode, or fork mode with reusePort)
 * - SCRIPT: Path to script/executable
 * - INTERPRETER: Interpreter command or path
 * - EXEC_MODE: 'cluster' or 'fork'
 * - REUSE_PORT: 'true' if runtime supports SO_REUSEPORT (allows multiple fork instances on same port)
 */

// In fork mode, PM2 doesn't share ports - unless the runtime supports SO_REUSEPORT
// (e.g., Bun with reusePort: true), in which case multiple fork instances CAN bind to the same port
const execMode = process.env.EXEC_MODE || "cluster";
const reusePort = process.env.REUSE_PORT === "true";
const requestedInstances = parseInt(process.env.I) || 1;
const actualInstances = (execMode === "fork" && !reusePort) ? 1 : requestedInstances;

module.exports = {
  apps: [
    {
      name: process.env.F || "fastify",
      script: process.env.SCRIPT || "./frameworks/nodejs/fastify.js",
      interpreter: process.env.INTERPRETER || "node",
      instances: actualInstances,
      exec_mode: execMode,
      env: {
        NODE_ENV: "production",
        REDIS_CLUSTER: "true",
        ...(process.env.REDIS_HOST && { REDIS_HOST: process.env.REDIS_HOST }),
        ...(process.env.REDIS_PORT && { REDIS_PORT: process.env.REDIS_PORT }),
        ...(process.env.REDIS_AGENT_URL && { REDIS_AGENT_URL: process.env.REDIS_AGENT_URL }),
      },
    },
  ],
};
