/**
 * Frameworks Config Cache
 * 
 * Fetches and caches framework configuration from API.
 * This allows the dashboard to run on a different machine from the API.
 */

let cachedConfig = null;
let initialized = false;

/**
 * Initialize config from API
 * @param {Object} apiClient - API client instance
 * @returns {Promise<Object>} Config object
 */
export async function initConfig(apiClient) {
  if (initialized && cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await apiClient.systemConfig();
    cachedConfig = {
      frameworks: response.frameworks || [],
      frameworkNames: response.frameworkNames || [],
      endpoints: response.endpoints || {},
      benchmarkableEndpoints: response.benchmarkableEndpoints || [],
      colors: response.colors || {},
      ports: response.ports || {},
      defaults: response.defaults || {},
    };
    initialized = true;
    return cachedConfig;
  } catch (error) {
    throw new Error(`Failed to fetch config from API: ${error.message}`);
  }
}

/**
 * Get cached config (must call initConfig first)
 * @returns {Object} Config object
 */
export function getConfig() {
  if (!initialized) {
    throw new Error("Config not initialized. Call initConfig(apiClient) first.");
  }
  return cachedConfig;
}

/**
 * Check if config is initialized
 * @returns {boolean}
 */
export function isConfigInitialized() {
  return initialized;
}

/**
 * Reset config cache (call before reconnecting to a different API)
 */
export function resetConfig() {
  cachedConfig = null;
  initialized = false;
}

// ==================== Helper functions (mirror API's frameworks.config.js) ====================

/**
 * Get all enabled frameworks
 * @returns {Array<Object>}
 */
export function getEnabledFrameworks() {
  return getConfig().frameworks;
}

/**
 * Get framework names as array
 * @returns {Array<string>}
 */
export function getFrameworkNames() {
  return getConfig().frameworkNames;
}

/**
 * Get framework by name
 * @param {string} name
 * @returns {Object|null}
 */
export function getFramework(name) {
  const fw = getConfig().frameworks.find(f => f.name === name);
  return fw || null;
}

/**
 * Check if framework exists and is enabled
 * @param {string} name
 * @returns {boolean}
 */
export function isValidFramework(name) {
  return getConfig().frameworkNames.includes(name);
}

/**
 * Get port for framework
 * @param {string} name
 * @returns {number|null}
 */
export function getFrameworkPort(name) {
  return getConfig().ports[name] || null;
}

/**
 * Get color for framework
 * @param {string} name
 * @returns {string}
 */
export function getFrameworkColor(name) {
  return getConfig().colors[name] || "white";
}

/**
 * Get framework color mapping
 * @returns {Object}
 */
export function getColorMapping() {
  return getConfig().colors;
}

/**
 * Get framework port mapping
 * @returns {Object}
 */
export function getPortMapping() {
  return getConfig().ports;
}

/**
 * Get all benchmarkable endpoints
 * @returns {Array<Object>}
 */
export function getBenchmarkableEndpoints() {
  return getConfig().benchmarkableEndpoints;
}

/**
 * Get all endpoints
 * @returns {Object}
 */
export function getEndpoints() {
  return getConfig().endpoints;
}
