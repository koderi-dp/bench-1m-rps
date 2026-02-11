import { LIMITS } from "../config/constants.js";
import { isValidFramework, getFrameworkNames } from "../config/frameworks.config.js";

/**
 * Validate PM2 instance count
 * @param {number} instances - Number of instances requested
 * @returns {{valid: boolean, message: string, needsConfirmation: boolean}}
 */
export function validatePM2Instances(instances) {
  const count = parseInt(instances, 10);

  if (isNaN(count) || count < 1) {
    return {
      valid: false,
      message: "Instance count must be at least 1",
      needsConfirmation: false
    };
  }

  if (count > LIMITS.maxPM2Instances) {
    return {
      valid: false,
      message: `Maximum ${LIMITS.maxPM2Instances} instances allowed. Use CLI for more: node api/scripts/pm2.js -start -f <framework> -i ${count}`,
      needsConfirmation: false
    };
  }

  if (count > LIMITS.warnPM2Instances) {
    return {
      valid: true,
      message: `Warning: ${count} instances is very high and may impact system stability`,
      needsConfirmation: true
    };
  }

  return {
    valid: true,
    message: "",
    needsConfirmation: false
  };
}

/**
 * Validate Redis node count
 * @param {number} nodes - Number of Redis nodes
 * @returns {{valid: boolean, message: string, replicas: number}}
 */
export function validateRedisNodes(nodes) {
  const count = parseInt(nodes, 10);

  if (isNaN(count) || count < LIMITS.minRedisNodes) {
    return {
      valid: false,
      message: `Redis cluster requires at least ${LIMITS.minRedisNodes} nodes`,
      replicas: 0
    };
  }

  // Calculate valid replica configurations
  // nodes = masters * (1 + replicas)
  // Try 0-3 replicas per master
  for (let replicas = 0; replicas <= 3; replicas++) {
    const mastersNeeded = count / (1 + replicas);
    if (Number.isInteger(mastersNeeded) && mastersNeeded >= 3) {
      return {
        valid: true,
        message: `${mastersNeeded} masters with ${replicas} replica(s) each`,
        replicas
      };
    }
  }

  return {
    valid: false,
    message: `${count} nodes cannot form a valid cluster topology. Try 3, 6, 9, etc.`,
    replicas: 0
  };
}

/**
 * Validate framework name
 * @param {string} framework - Framework name
 * @returns {{valid: boolean, message: string}}
 */
export function validateFramework(framework) {
  if (!framework || !isValidFramework(framework.toLowerCase())) {
    return {
      valid: false,
      message: `Framework must be one of: ${getFrameworkNames().join(', ')}`
    };
  }

  return {
    valid: true,
    message: ""
  };
}

/**
 * Validate endpoint path
 * @param {string} endpoint - Endpoint path
 * @returns {{valid: boolean, message: string}}
 */
export function validateEndpoint(endpoint) {
  if (!endpoint || !endpoint.startsWith('/')) {
    return {
      valid: false,
      message: "Endpoint must start with /"
    };
  }

  return {
    valid: true,
    message: ""
  };
}

/**
 * Parse PM2 instance count with validation
 * @param {string} input - User input
 * @returns {{count: number, validation: object}}
 */
export function parsePM2Instances(input) {
  const count = parseInt(input, 10);
  const validation = validatePM2Instances(count);
  
  return { count, validation };
}

/**
 * Parse Redis node count with validation
 * @param {string} input - User input
 * @returns {{count: number, validation: object}}
 */
export function parseRedisNodes(input) {
  const count = parseInt(input, 10);
  const validation = validateRedisNodes(count);
  
  return { count, validation };
}
