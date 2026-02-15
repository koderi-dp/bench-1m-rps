---
name: add-endpoint
description: Step-by-step guide for adding a new benchmark endpoint to the system. Use when the user wants to add a new HTTP endpoint (e.g., bulk insert, search, delete) that all frameworks should implement and that can be benchmarked.
---

# Add Endpoint

Add a new benchmark endpoint to the node-1m-rps suite. Endpoints are defined centrally and auto-propagate to all frameworks, the CLI, and the dashboard.

## When to Use

- User wants to add a new benchmark endpoint (e.g., `/bulk`, `/search`, `/delete`)
- User wants to test a new Redis operation pattern
- User wants to add a non-benchmarkable utility endpoint

## Instructions

### Step 1: Define the Endpoint in Configuration

Add the endpoint to the `ENDPOINTS` object in `api/config/frameworks.config.js`:

```javascript
myEndpoint: {
  path: "/my-endpoint",                    // HTTP path
  method: "POST",                          // HTTP method: GET, POST, PUT, DELETE, PATCH
  description: "Description for CLI help", // Human-readable description
  benchmarkable: true,                     // true = auto-generates bench commands
  shortName: "myep",                       // CLI suffix: `bench fastify myep` (empty string = default)
},
```

**Key rules:**
- `shortName` is used in CLI commands: `npx rps bench <framework> <shortName>`
- If `shortName` is `""` (empty), it becomes the default benchmark (like `/simple`)
- Only one endpoint should have empty `shortName` — currently that's `/simple`
- `benchmarkable: false` means it won't appear in benchmark menus/CLI but can still be used

### Step 2: Implement the Handler

Add the handler function to the shared handler files:

**Node.js** — `frameworks/nodejs/handlers.js`:
```javascript
/**
 * POST /my-endpoint - Description
 * Document Redis operations if any
 */
export async function handleMyEndpoint(params) {
  // Business logic here
  // For Redis operations, import from '../utils.js'
  
  return {
    status: 200,  // or 201, 404, 409, etc.
    data: { result: "value" }
  };
}
```

**Bun** — `frameworks/bun/handlers.ts`:
- Same logic, same function signature
- Can use Bun-specific APIs for optimization
- Must return the same `{ status, data }` format

**Handler conventions:**
- Return `{ status: number, data: object }` for explicit status codes
- Return plain objects for 200 responses (simple endpoints)
- Use async for Redis operations
- Import Redis helpers from `frameworks/utils.js` if needed

### Step 3: Register Routes in Each Framework

Add the route to each framework server file:

**Fastify** (`frameworks/nodejs/fastify.js`):
```javascript
app.post("/my-endpoint", async (req, res) => {
  const result = await handleMyEndpoint(req.body);
  res.status(result.status).send(result.data);
});
```

**Express** (`frameworks/nodejs/express.js`):
```javascript
app.post("/my-endpoint", async (req, res) => {
  const result = await handleMyEndpoint(req.body);
  res.status(result.status).json(result.data);
});
```

**Bun** (`frameworks/bun/bun-native.ts`):
```typescript
if (url.pathname === "/my-endpoint" && req.method === "POST") {
  const body = await req.json();
  const result = await handleMyEndpoint(body);
  return Response.json(result.data, { status: result.status });
}
```

### Step 4: Verify

After adding the endpoint:

1. CLI auto-discovers it: `npx rps help` (check Benchmarks section)
2. Benchmark commands are auto-generated: `npx rps bench <framework> <shortName>`
3. Dashboard menu shows it under Benchmarks for each enabled framework
4. Test manually: `curl -X POST http://localhost:<port>/my-endpoint`

### Adding Redis Helpers (if needed)

If the endpoint needs new Redis operations, add helpers to `frameworks/utils.js`:

```javascript
export async function myRedisHelper() {
  // Use imported `redis` (ioredis instance, cluster-aware)
  const result = await redis.get("my:key");
  return result;
}
```

**Redis key conventions:**
- Use colon-separated namespaces: `codes:seq`, `codes:unique`, `codes:{id}`
- Avoid hash tags `{...}` to distribute across cluster masters
- For high-throughput writes, consider sharded queues (see `handleCodeUltraFastCreate` pattern)

## Example: Adding a Bulk Insert Endpoint

1. Add to `ENDPOINTS` in `api/config/frameworks.config.js`:
   ```javascript
   bulkInsert: {
     path: "/bulk",
     method: "POST",
     description: "Bulk insert 100 records (throughput test)",
     benchmarkable: true,
     shortName: "bulk",
   },
   ```

2. Add handler to `frameworks/nodejs/handlers.js` and `frameworks/bun/handlers.ts`

3. Register route in `fastify.js`, `express.js`, `cpeak.js`, `bun-native.ts`

4. Test: `npx rps bench fastify bulk`

## Common Pitfalls

- **Consistency**: All framework implementations must return the same response format for the same endpoint
- **Path conflicts**: Check existing paths in `ENDPOINTS` before adding
- **shortName uniqueness**: Each endpoint's `shortName` must be unique
- **Redis CROSSSLOT**: Don't use multi-key commands across different hash slots in cluster mode — use separate commands
