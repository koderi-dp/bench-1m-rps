---
name: run-benchmark
description: Guide for running HTTP benchmarks using the node-1m-rps system. Use when the user wants to benchmark a framework, understand benchmark results, configure benchmark parameters, or troubleshoot benchmark issues.
---

# Run Benchmark

Run HTTP load tests against framework servers using autocannon. Benchmarks measure requests per second, latency, and throughput.

## When to Use

- User wants to run a benchmark against a framework
- User wants to compare framework performance
- User wants to understand or interpret benchmark results
- User needs to troubleshoot why benchmarks fail or show unexpected results

## Prerequisites

Before running benchmarks, ensure:

1. **API server is running**: `npm run api` (or `node api/server.js`)
2. **Redis cluster is up** (for `/code` and `/code-fast` endpoints): Setup via dashboard menu or `node api/scripts/redis.js -setup -n 6`
3. **Framework is started via PM2**: Start via dashboard menu or `node api/scripts/pm2.js -start -f <framework> -i <instances>`

## Running Benchmarks

### Via Dashboard (Recommended)

1. Start the dashboard: `npm run client`
2. Press **m** to open the menu
3. Navigate to **Benchmarks**
4. Select a framework and endpoint
5. Results appear in the benchmark table and activity log

### Via CLI

```bash
# Default benchmark (GET /simple)
npx rps bench fastify

# Specific endpoint
npx rps bench fastify code      # POST /code (write test)
npx rps bench fastify read      # GET /code-fast (read test)

# Same for Bun
npx rps bench bun
npx rps bench bun code
npx rps bench bun read
```

### Via autocannon Directly

```bash
# GET /simple — framework overhead
npx autocannon -m GET -c 20 -d 20 -p 2 -w 6 http://localhost:3002/simple

# POST /code — write throughput
npx autocannon -m POST -c 20 -d 20 -p 2 -w 6 http://localhost:3002/code

# GET /code-fast — read throughput
npx autocannon -m GET -c 20 -d 20 -p 2 -w 6 http://localhost:3002/code-fast
```

**autocannon parameters:**
- `-c 20` — 20 concurrent connections
- `-d 20` — 20 second duration
- `-p 2` — 2 pipelined requests per connection
- `-w 6` — 6 worker threads

## Benchmark Endpoints

| Endpoint | Method | What it Tests | Redis Ops |
|----------|--------|---------------|-----------|
| `/simple` | GET | Pure framework overhead | None |
| `/code` | POST | Write throughput (validation + Redis) | 4 ops: SADD, INCR, HSET, LPUSH |
| `/code-fast` | GET | Read throughput (cached lookups) | 1-2 ops: GET (cached), HGETALL |

## Understanding Results

Key metrics from autocannon:
- **Req/Sec** — Requests per second (the main metric)
- **Avg Latency** — Average response time in milliseconds
- **Max Latency** — Worst-case response time
- **Throughput** — Data transferred per second
- **Total Requests** — Total requests completed during the test
- **Errors** — Timeouts, connection resets, non-2xx responses

## Benchmark History

Results are stored in SQLite (`api/data/benchmark.db`) and can be viewed:
- Press **b** in the dashboard to open the benchmark history overlay
- `GET /api/benchmark/all` — All results via API
- `GET /api/benchmark/latest` — Latest results
- `GET /api/benchmark/latest-by-framework` — Best per framework
- `DELETE /api/benchmark/clear` — Clear history

## Troubleshooting

### "Connection refused" errors
- Framework server isn't running. Start it with PM2: `node api/scripts/pm2.js -start -f <framework>`

### Low request rates on /code or /code-fast
- Redis cluster might not be running: `node api/scripts/redis.js -setup -n 6`
- Check Redis status: `redis-cli -p 7000 cluster info`

### Inconsistent results
- Ensure no other CPU-intensive processes are running
- Use consistent instance counts across frameworks for fair comparison
- Warm up the server first with a short benchmark before the real one

### "No codes found" on /code-fast
- Run `/code` (POST) benchmark first to populate Redis with data
- The `/code-fast` endpoint reads random records — they must exist first

## Tips for Maximum Performance

1. **Instance count**: Match to CPU cores minus 2 (reserve for Redis + system)
2. **Redis nodes**: 6 nodes (3 masters + 3 replicas) is the sweet spot
3. **Warm-up**: Run a 5-second benchmark before the real one to warm JIT
4. **Isolate**: Close unnecessary applications during benchmarks
5. **Linux**: Best performance on bare metal Linux (not WSL/Docker)
