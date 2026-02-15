---
name: project-overview
description: Provides a comprehensive overview of the node-1m-rps project architecture, conventions, and codebase structure. Use when you need to understand how the project works, its components, coding patterns, or when making changes that span multiple parts of the system.
---

# Project Overview — node-1m-rps

High-performance Node.js benchmarking tool targeting 1 million requests per second. Compares different frameworks/runtimes (Fastify, Bun, Express, etc.) against Redis-backed endpoints.

## Architecture

Client-server architecture with two main components:

- **API Server** (`api/`) — Express REST API + WebSocket server on port 3100. Runs on the machine where PM2 and Redis execute. Manages Redis cluster, PM2 processes, benchmarks, and system stats.
- **Dashboard** (`dashboard/`) — Terminal UI built with `blessed`/`blessed-contrib`. Connects to the API via HTTP/WS. Can run locally or remotely.

```
Dashboard (TUI)  <──HTTP/WS──>  API Server (port 3100)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              Redis Cluster     PM2 Daemon     Framework Servers
              (ports 7000+)                    (ports 3000-3005)
```

## Project Structure

```
node-1m-rps/
├── api/                        # API server (Express, port 3100)
│   ├── config/
│   │   ├── frameworks.config.js  # Central framework + endpoint config (IMPORTANT)
│   │   ├── ecosystem.config.cjs  # PM2 ecosystem config
│   │   └── constants.js
│   ├── routes/
│   │   ├── pm2.js              # /api/pm2/* routes
│   │   ├── redis.js            # /api/redis/* routes
│   │   ├── benchmark.js        # /api/benchmark/* routes
│   │   ├── system.js           # /api/system/* routes
│   │   └── websocket.js        # WebSocket handler
│   ├── services/
│   │   ├── pm2.service.js      # PM2 process management
│   │   ├── redis.service.js    # Redis cluster management
│   │   ├── benchmark.service.js # Benchmark history (SQLite)
│   │   └── logger.service.js
│   ├── scripts/
│   │   ├── rps.js              # CLI tool (npx rps)
│   │   ├── pm2.js              # PM2 management script
│   │   └── redis.js            # Redis cluster management script
│   └── server.js               # Main API entry point
├── dashboard/                  # Terminal UI
│   ├── controllers/            # Update, navigation, command controllers
│   ├── services/               # API client, adapters, benchmark, logger
│   ├── ui/
│   │   ├── layouts/            # Main layout
│   │   ├── widgets/            # Charts, lists, tables
│   │   └── overlays/           # Menu, benchmark, prompt, selection
│   ├── state/                  # Dashboard state management
│   ├── config/                 # Constants, frameworks config (loaded from API)
│   └── index.js                # Dashboard entry point
├── frameworks/                 # Benchmark target servers
│   ├── nodejs/
│   │   ├── handlers.js         # Shared endpoint handlers (business logic)
│   │   ├── fastify.js          # Fastify server (port 3002)
│   │   ├── express.js          # Express server (port 3001)
│   │   └── cpeak.js            # Cpeak server (port 3000)
│   ├── bun/
│   │   ├── handlers.ts         # Bun-specific handlers
│   │   └── bun-native.ts       # Bun.serve() server (port 3003)
│   └── utils.js                # Shared Redis helpers (createCodeRecord, etc.)
├── database/
│   └── redis.js                # ioredis client (cluster-aware)
└── package.json                # ESM ("type": "module"), bin: "rps"
```

## Key Conventions

### Module System
- ESM everywhere (`"type": "module"` in package.json)
- Use `import`/`export`, never `require`

### Central Configuration
- `api/config/frameworks.config.js` is the **single source of truth** for frameworks and endpoints
- Adding a framework or endpoint there auto-propagates to PM2, benchmarks, dashboard, and CLI
- Dashboard loads config from API at startup via `GET /api/system/config`

### Framework Pattern
Each framework server file follows this pattern:
1. Import shared handlers from `./handlers.js` (or `./handlers.ts` for Bun)
2. Register routes that delegate to handlers
3. Handlers return `{ status, data }` objects
4. Server listens on its configured port from `frameworks.config.js`

### Handler Pattern
Business logic lives in handler files (`frameworks/nodejs/handlers.js`, `frameworks/bun/handlers.ts`):
- `handleSimpleGet()` — returns `{ message: "hi" }` (no Redis)
- `handleCodeCreate()` — writes to Redis, returns `{ status, data }`
- `handleCodeRead()` — reads from Redis, returns `{ status, data }`

### API Routes Pattern
Express routes in `api/routes/*.js`:
- Use Express Router
- Instantiate a service class
- Try/catch with `next(error)` for error handling
- Return JSON responses with timestamps

### Redis
- Uses `ioredis` with cluster support
- Cluster data stored in `../redis-cluster/` (one level up from project root)
- Ports 7000-7999 for cluster nodes
- Keys: `codes:seq`, `codes:unique`, `codes:{id}`, `codes:sync_queue`

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `API_SERVER` | `http://localhost:3100` | API URL (dashboard) |
| `API_PORT` | `3100` | API port |
| `API_KEY` | (none) | Optional API key |
| `REDIS_CLUSTER` | `false` | Enable Redis cluster mode |
| `LOG_LEVEL` | `info` | Dashboard log level |

### Dependencies
- `express` (API server), `fastify` (benchmark framework)
- `ioredis` (Redis client), `autocannon` (HTTP benchmarking)
- `blessed`/`blessed-contrib` (terminal UI)
- `better-sqlite3` (benchmark history storage)
- `pino`/`pino-pretty` (logging), `ws` (WebSocket)
- `pm2` (process management, global install expected)
