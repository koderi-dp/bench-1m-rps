---
name: manage-redis
description: Guide for managing the Redis cluster in the node-1m-rps project. Use when the user needs to set up, stop, resume, clean, or troubleshoot the Redis cluster, or when making changes to Redis-related code.
---

# Manage Redis Cluster

Manage the Redis cluster used by the benchmark framework servers. The cluster runs on ports 7000+ with data stored in `../redis-cluster/` (one level up from the project root).

## When to Use

- User wants to set up, stop, resume, or clean the Redis cluster
- User is troubleshooting Redis connectivity issues
- User needs to understand Redis key structure or cluster topology
- User is modifying Redis-related code

## Redis Cluster Operations

### Via Dashboard

1. Start dashboard: `npm run client`
2. Press **m** for menu
3. Navigate to **Redis Cluster** section
4. Available actions: Setup, Stop, Resume, Clean, Status

### Via CLI Scripts

```bash
# Setup a 6-node cluster (3 masters + 3 replicas)
node api/scripts/redis.js -setup -n 6

# Setup with custom replicas
node api/scripts/redis.js -setup -n 6 -r 1

# Setup 3 masters only (no replicas)
node api/scripts/redis.js -setup -n 3

# Stop all nodes (preserves data)
node api/scripts/redis.js -stop

# Resume stopped nodes
node api/scripts/redis.js -resume

# Clean (stop + delete all data)
node api/scripts/redis.js -clean
```

### Via RPS CLI

```bash
npx rps redis setup    # Setup 6-node cluster
npx rps redis stop     # Stop cluster
npx rps redis resume   # Resume cluster
npx rps redis clean    # Clean all data
npx rps redis status   # Check status
```

### Via API

```bash
# Setup
curl -X POST http://localhost:3100/api/redis/setup -H "Content-Type: application/json" -d '{"nodeCount": 6}'

# Stop
curl -X POST http://localhost:3100/api/redis/stop

# Resume
curl -X POST http://localhost:3100/api/redis/resume

# Clean
curl -X POST http://localhost:3100/api/redis/clean

# Status
curl http://localhost:3100/api/redis/status

# Node list
curl http://localhost:3100/api/redis/nodes

# Stats (ops/s, memory, connections per master)
curl http://localhost:3100/api/redis/stats
```

## Cluster Architecture

```
Default 6-node cluster:
  Master 1 (port 7000) ←→ Replica 1 (port 7003)
  Master 2 (port 7001) ←→ Replica 2 (port 7004)
  Master 3 (port 7002) ←→ Replica 3 (port 7005)

Hash slots distributed across 3 masters (0-5460, 5461-10922, 10923-16383)
```

- Minimum 3 nodes for a cluster (3 masters, 0 replicas)
- Recommended 6 nodes (3 masters + 3 replicas) for fault tolerance
- Data directory: `../redis-cluster/<port>/` for each node
- Auto-detection: The system scans `../redis-cluster/` for port directories

## Redis Key Structure

| Key | Type | Description |
|-----|------|-------------|
| `codes:seq` | String (counter) | Auto-incrementing ID sequence |
| `codes:unique` | Set | Uniqueness check for generated codes |
| `codes:{id}` | Hash | Individual code record (id, code, created_at) |
| `codes:sync_queue` | List | Queue for sync processing |
| `code:{uuid}` | String | Ultra-fast code storage (UUID-based) |
| `codes:sync_queue:{shard}` | List | Sharded sync queue (1-100 shards) |

**Key design for cluster:**
- No hash tags `{...}` on main keys — distributes across all masters
- Each key independently hashes to a slot
- Avoid multi-key operations across slots (causes CROSSSLOT errors)

## Code Files

| File | Purpose |
|------|---------|
| `api/scripts/redis.js` | CLI script for cluster management |
| `api/services/redis.service.js` | API service (stats, setup, stop, etc.) |
| `api/routes/redis.js` | API routes for Redis operations |
| `database/redis.js` | ioredis client instance (used by frameworks) |
| `frameworks/utils.js` | Shared Redis helpers (createCodeRecord, etc.) |

## Troubleshooting

### "Redis cluster not running"
```bash
node api/scripts/redis.js -setup -n 6
```

### CROSSSLOT errors
- Don't use multi-key commands (MGET, MSET) across different hash slots
- Use separate individual commands instead
- See `frameworks/utils.js` for the correct pattern

### "Connection refused" on port 7000
- Cluster isn't running: `node api/scripts/redis.js -setup -n 6`
- Or nodes are stopped: `node api/scripts/redis.js -resume`

### High memory usage
- Clean and restart: `node api/scripts/redis.js -clean && node api/scripts/redis.js -setup -n 6`

### Production Redis (redis6-server)
- Use the `-prod` flag: `node api/scripts/redis.js -setup -n 6 -prod`
- This uses `redis6-server` and `redis6-cli` binaries

## Connecting from Frameworks

Frameworks use the shared Redis client in `database/redis.js`:
- Auto-detects cluster mode via `REDIS_CLUSTER=true` environment variable
- Standalone mode connects to `localhost:6379` by default
- Cluster mode connects to `localhost:7000-7005`

To run a framework with cluster support:
```bash
REDIS_CLUSTER=true node frameworks/nodejs/fastify.js
```
