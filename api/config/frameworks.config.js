/**
 * Central Framework and Endpoint Configuration
 * 
 * This file defines all frameworks and their endpoints in one place.
 * To add a new framework or endpoint, simply update this configuration.
 * 
 * Framework Properties:
 * - name: Internal identifier (lowercase, no spaces)
 * - displayName: Human-readable name shown in UI
 * - port: Port number for the server
 * - color: Color for UI display (green, blue, magenta, yellow, cyan, red, white)
 * - file: Path to the server file (relative to project root)
 * - enabled: Whether this framework is active
 * - runtime: Runtime name (node, bun, dotnet, go, etc.)
 * - interpreter: Interpreter command (node, bun, dotnet, go, etc.)
 * - interpreterPath: (Optional) Full path to interpreter. If not set, uses interpreter from PATH
 * - execMode: PM2 execution mode ('cluster' or 'fork')
 * - reusePort: (Optional) If true, fork mode allows multiple instances via SO_REUSEPORT (Linux only)
 * - instances: Default number of PM2 instances
 * 
 * How to Add New Runtimes (C#, Go, Rust, etc.):
 * 1. Create your executable or script in frameworks/<runtime>/
 * 2. Add configuration here with appropriate interpreter/execMode
 * 3. PM2 and benchmarking will work automatically!
 * 
 * Examples:
 * - Node.js/Fastify: cluster mode, 10+ instances
 * - Bun: fork mode + reusePort, 10+ instances (native SO_REUSEPORT on Linux)
 * - C# (.NET): fork mode, 1 instance per executable
 * - Go: fork mode, 1 instance per binary (or reusePort if supported)
 */

export const FRAMEWORKS = {
  cpeak: {
    name: "cpeak",
    displayName: "Cpeak",
    port: 3000,
    color: "green",
    file: "frameworks/nodejs/cpeak.js",
    enabled: false, // Disabled - using Fastify as Node.js representative
    runtime: "node",
    interpreter: "node",
    execMode: "cluster",
    instances: 6,
  },
  express: {
    name: "express",
    displayName: "Express",
    port: 3001,
    color: "blue",
    file: "frameworks/nodejs/express.js",
    enabled: false, // Disabled - using Fastify as Node.js representative
    runtime: "node",
    interpreter: "node",
    execMode: "cluster",
    instances: 6,
  },
  fastify: {
    name: "fastify",
    displayName: "Fastify (Node.js)",
    port: 3002,
    color: "magenta",
    file: "frameworks/nodejs/fastify.js",
    enabled: true,
    runtime: "node",
    interpreter: "node",
    execMode: "cluster",
    instances: 10,
  },
  bun: {
    name: "bun",
    displayName: "Bun (Native)",
    port: 3003,
    color: "yellow",
    file: "frameworks/bun/bun-native.ts",
    enabled: true,
    runtime: "bun",
    interpreter: "bun",
    interpreterPath: process.env.HOME ? `${process.env.HOME}/.bun/bin/bun` : "bun",
    execMode: "fork", // PM2 cluster mode doesn't work with Bun
    reusePort: true,  // Bun's native SO_REUSEPORT - allows multiple fork instances on same port (Linux only)
    instances: 10,
  },
  csharp: {
    name: "csharp",
    displayName: "C# (.NET)",
    port: 3004,
    color: "cyan",
    file: "frameworks/csharp/build/csharp", // Path to compiled executable
    enabled: true,
    runtime: "dotnet",
    interpreter: "none", // Use "none" for compiled binaries - PM2 runs the file directly
    execMode: "fork",
    instances: 1,
  },
  // Example: Go implementation (uncomment and configure when ready)
  // go: {
  //   name: "go",
  //   displayName: "Go (Native)",
  //   port: 3005,
  //   color: "cyan",
  //   file: "frameworks/go/server", // Path to compiled binary
  //   enabled: false,
  //   runtime: "go",
  //   interpreter: "none", // Use "none" for compiled binaries
  //   execMode: "fork",
  //   instances: 1,
  // },
};

/**
 * Endpoint definitions
 * These endpoints should be implemented in each framework file
 * 
 * Benchmarking Strategy:
 * - /simple (GET): Pure framework overhead baseline
 * - /code (POST): Write performance with validation (5 Redis ops)
 * - /code-fast (GET): Read performance with caching (2 Redis ops)
 * 
 * Properties:
 * - path: HTTP path (e.g., "/simple")
 * - method: HTTP method (e.g., "GET", "POST")
 * - description: Human-readable description for CLI help
 * - benchmarkable: If true, auto-generates bench commands in rps.js
 * - shortName: Command suffix for `bench <framework> <shortName>` (empty for default)
 * 
 * Example - Adding a new endpoint:
 * ```
 * bulkInsert: {
 *   path: "/bulk",
 *   method: "POST",
 *   description: "Bulk insert 100 records (throughput test)",
 *   benchmarkable: true,
 *   shortName: "bulk",
 * }
 * ```
 * This automatically creates:
 * - `bench fastify bulk` → `node bench.js -f fastify -e /bulk -m POST`
 * - `bench bun bulk` → `node bench.js -f bun -e /bulk -m POST`
 * - Help text showing description
 * - No changes needed to rps.js!
 */
export const ENDPOINTS = {
  simple: {
    path: "/simple",
    method: "GET",
    description: "Simple text response (pure framework overhead test)",
    benchmarkable: true,
    shortName: "", // Empty = default, no suffix needed
  },
  code: {
    path: "/code",
    method: "POST",
    description: "Create code with Redis and validation (write performance test)",
    benchmarkable: true,
    shortName: "code",
  },
  codeFastGet: {
    path: "/code-fast",
    method: "GET",
    description: "Read code from Redis with O(1) lookup (read performance test)",
    benchmarkable: true,
    shortName: "read",
  },
};

/**
 * Default configuration
 */
export const CONFIG = {
  defaultFramework: "fastify",
  defaultEndpoint: "/simple",
  defaultMethod: "GET",
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get all enabled frameworks
 * @returns {Array<Object>} Array of enabled framework configs
 */
export function getEnabledFrameworks() {
  return Object.values(FRAMEWORKS).filter(fw => fw.enabled);
}

/**
 * Get framework names as array
 * @returns {Array<string>} Array of framework names
 */
export function getFrameworkNames() {
  return getEnabledFrameworks().map(fw => fw.name);
}

/**
 * Get framework by name
 * @param {string} name - Framework name
 * @returns {Object|null} Framework config or null
 */
export function getFramework(name) {
  return FRAMEWORKS[name] || null;
}

/**
 * Check if framework exists and is enabled
 * @param {string} name - Framework name
 * @returns {boolean}
 */
export function isValidFramework(name) {
  const fw = FRAMEWORKS[name];
  return fw && fw.enabled;
}

/**
 * Get port for framework
 * @param {string} name - Framework name
 * @returns {number|null} Port number or null
 */
export function getFrameworkPort(name) {
  const fw = FRAMEWORKS[name];
  return fw ? fw.port : null;
}

/**
 * Get color for framework
 * @param {string} name - Framework name
 * @returns {string} Color name
 */
export function getFrameworkColor(name) {
  const fw = FRAMEWORKS[name];
  return fw ? fw.color : "white";
}

/**
 * Get all benchmarkable endpoints
 * @returns {Array<Object>} Array of benchmarkable endpoint configs
 */
export function getBenchmarkableEndpoints() {
  return Object.entries(ENDPOINTS)
    .filter(([_, config]) => config.benchmarkable)
    .map(([key, config]) => ({ key, ...config }));
}

/**
 * Get endpoints for a specific framework
 * @param {string} frameworkName - Framework name
 * @returns {Array<Object>} Array of endpoint configs
 */
export function getEndpointsForFramework(frameworkName) {
  return Object.entries(ENDPOINTS)
    .filter(([_, config]) => {
      // If endpoint specifies frameworks, check if this framework is included
      if (config.frameworks) {
        return config.frameworks.includes(frameworkName);
      }
      // Otherwise, endpoint is available to all frameworks
      return true;
    })
    .map(([key, config]) => ({ key, ...config }));
}

/**
 * Get endpoint by path and method
 * @param {string} path - Endpoint path
 * @param {string} method - HTTP method
 * @returns {Object|null} Endpoint config or null
 */
export function getEndpoint(path, method) {
  const entry = Object.entries(ENDPOINTS).find(
    ([_, config]) => config.path === path && config.method === method
  );
  return entry ? { key: entry[0], ...entry[1] } : null;
}

/**
 * Get framework port mapping as object
 * @returns {Object} Map of framework name to port
 */
export function getPortMapping() {
  const mapping = {};
  for (const [name, config] of Object.entries(FRAMEWORKS)) {
    if (config.enabled) {
      mapping[name] = config.port;
    }
  }
  return mapping;
}

/**
 * Get framework color mapping as object
 * @returns {Object} Map of framework name to color
 */
export function getColorMapping() {
  const mapping = {};
  for (const [name, config] of Object.entries(FRAMEWORKS)) {
    if (config.enabled) {
      mapping[name] = config.color;
    }
  }
  return mapping;
}
