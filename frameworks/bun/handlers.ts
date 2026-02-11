import { redis } from "../../database/redis.js";
import {
  createCodeRecord,
  generateCode,
  getRandomCodeRecord,
} from "../utils.js";

/**
 * Bun-Optimized Endpoint Handlers
 * 
 * This file contains Bun-specific implementations of endpoint handlers.
 * Uses Bun APIs where beneficial for performance.
 * 
 * Handler return format: { status?: number, data?: any } or raw data
 * - Simple handlers return data directly
 * - Complex handlers return { status, data } for explicit status codes
 */

/**
 * GET /simple - Simple JSON response
 * Tests pure framework overhead with minimal processing
 */
export function handleSimpleGet() {
  return { message: "hi" };
}

/**
 * POST /code - Create code with full validation
 * Tests write throughput with Redis + uniqueness checks
 * 
 * Redis operations:
 * - SADD codes:unique (uniqueness check)
 * - INCR codes:seq (get ID)
 * - HSET codes:{id} (store record)
 * - LPUSH codes:sync_queue (queue for sync)
 */
export async function handleCodeCreate() {
  const created = await createCodeRecord();
  
  if (!created) {
    return {
      status: 409,
      data: { error: "Code already exists." }
    };
  }
  
  return {
    status: 201,
    data: { created_code: created }
  };
}

/**
 * GET /code-fast - Read random code from Redis
 * Tests read throughput with O(1) lookups
 * 
 * Redis operations:
 * - GET codes:seq (cached every 500ms)
 * - HGETALL codes:{randomId}
 */
export async function handleCodeRead() {
  const result = await getRandomCodeRecord();
  
  if (!result) {
    return {
      status: 404,
      data: { error: "No codes found." }
    };
  }
  
  return {
    status: 200,
    data: { data: result }
  };
}
