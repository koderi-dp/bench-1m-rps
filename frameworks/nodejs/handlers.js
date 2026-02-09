import crypto from "crypto";
import { redis } from "../../database/redis.js";
import {
  createCodeRecord,
  generateCode,
  getRandomCodeRecord,
} from "../../utils.js";

/**
 * Shared Endpoint Handlers
 * 
 * This file contains all business logic for endpoints.
 * Framework-specific files (frameworks/nodejs/*.js) 
 * wrap these handlers with their routing syntax.
 */

/**
 * GET /simple - Simple JSON response
 * Tests pure framework overhead
 */
export function handleSimpleGet() {
  return { message: "hi" };
}

/**
 * PATCH /update-something/:id/:name - Complex data processing
 * Tests validation, parsing, and large response generation
 * 
 * NOTE: This is a synthetic benchmark endpoint - not recommended for actual benchmarking
 */
export function handleUpdateSomething({ id, name, query, body }) {
  // Validate id and name
  if (isNaN(Number(id))) {
    return {
      status: 400,
      data: { error: "id must be a number" }
    };
  }
  
  if (!name || name.length < 3) {
    return {
      status: 400,
      data: { error: "name is required and must be at least 3 characters" }
    };
  }

  const { value1, value2 } = query;
  const formattedFooValues = [];

  for (let i = 1; i <= 10; i++) {
    const val = body[`foo${i}`];
    const formattedVal = typeof val === "string" ? `${val}. ` : val;
    formattedFooValues.push(formattedVal);
  }

  // Adding all the formatted foo values together
  const totalFoo = formattedFooValues.join("");

  // Generating a few kilobytes of dummy data
  const dummyHistory = Array.from({ length: 100 }).map((_, i) => ({
    event_id: Number(id) + i,
    timestamp: new Date().toISOString(),
    action: `Action performed by ${name}`,
    metadata:
      "This is a string intended to take up space to simulate a medium-sized production API response object.".repeat(
        2,
      ),
    status: i % 2 === 0 ? "success" : "pending",
  }));

  return {
    status: 200,
    data: {
      id,
      name,
      value1,
      value2,
      total_foo: String(totalFoo).toUpperCase(),
      history: dummyHistory,
    }
  };
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

/**
 * POST /code-ultra-fast - Ultra-optimized code creation (Cpeak only)
 * Tests maximum write throughput without uniqueness checks
 * 
 * Optimizations:
 * - Uses UUID instead of incremental IDs (no collision for 86,000 years)
 * - Skips SADD uniqueness check
 * - Sharded queues (100 shards) for high throughput
 * - Direct SET instead of HSET
 * 
 * Redis operations:
 * - SET code:{uuid}
 * - LPUSH codes:sync_queue:{shard}
 */
export async function handleCodeUltraFastCreate() {
  /**
   * We won't bother with id uniqueness here because at a rate of 1 million
   * requests per second, it would take approximately 86,000 years to reach a 50%
   * probability of at least one id duplicate.
   *
   * The math is based on the birthday paradox problem approximation:
   * P(collision) ≈ 1 - e^(-n²/(2N))
   *
   * Where:
   * n = number of UUIDs generated
   * N = total possible UUIDs = 2^122
   * e = Euler's number (≈ 2.71828)
   *
   * For 50% collision probability, we solve:
   * 0.5 = 1 - e^(-n²/(2×2^122))
   *
   * This gives n ≈ 2.7×10^18 UUIDs. At 1 million UUIDs per second, this would take:
   *
   * Time (seconds) = n / 1,000,000 = 2.7×10^12 seconds
   * Time (years) = 2.7×10^12 / (60×60×24×365) ≈ 86,000 years.
   *
   * Thus, for all practical purposes, we can consider UUID collisions negligible
   * in this context.
   */
  const id = crypto.randomUUID(); // generates a 122-bit random UUID

  const code = generateCode();
  const created_at = new Date().toISOString();

  const record = JSON.stringify({ id, code, created_at });

  await redis.set(`code:{${id}}`, record);

  // Keep queue sharded for high write throughput
  const shard = Math.floor(Math.random() * 100) + 1;
  await redis.lpush(`codes:sync_queue:{${shard}}`, id);

  return {
    status: 201,
    data: { created_code: { id, code, created_at } }
  };
}
