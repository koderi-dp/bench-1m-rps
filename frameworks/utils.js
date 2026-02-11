import crypto from "crypto";
import { redis } from "../database/redis.js";

const generateCode = () => {
  // 375 random bytes becomes 500 Base64 characters
  return crypto.randomBytes(375).toString("base64").substring(0, 500);
};

let cachedMaxId = 0;
let lastCacheUpdate = 0;

// Helper to get max ID with caching to improve performance and save Redis calls.
// Only used in /code-fast GET endpoint.
async function getMaxId() {
  const now = Date.now();
  // Refresh only if cache is older than 500ms
  if (now - lastCacheUpdate > 500) {
    const maxIdStr = await redis.get("codes:seq");
    if (maxIdStr) {
      cachedMaxId = parseInt(maxIdStr, 10);
      lastCacheUpdate = now;
    }
  }
  return cachedMaxId;
}

async function createCodeRecord() {
  const code = generateCode();

  // Remove hash tags to distribute keys across all Redis Cluster masters
  const isNew = await redis.sadd("codes:unique", code);

  if (isNew === 0) {
    return null;
  }

  const id = await redis.incr("codes:seq");
  const created_at = new Date().toISOString();

  // Execute commands separately to avoid CROSSSLOT errors in Redis Cluster
  // Keys will distribute across different masters based on their individual hash slots
  await redis.hset(`codes:${id}`, { id, code, created_at });
  await redis.lpush("codes:sync_queue", id);

  return { id, code, created_at };
}

async function getRandomCodeRecord() {
  const maxId = await getMaxId();
  if (maxId === 0) {
    return null;
  }

  const randomId = crypto.randomInt(1, maxId + 1);
  const result = await redis.hgetall(`codes:${randomId}`);

  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}

export { generateCode, getMaxId, createCodeRecord, getRandomCodeRecord };
