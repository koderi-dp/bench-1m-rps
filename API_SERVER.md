# API Server

A Node.js REST/WebSocket API server that provides remote access to PM2, Redis, system metrics, and benchmarking capabilities. This allows you to:

- Run a dashboard on a client machine
- Run benchmarks from a remote client
- Monitor server metrics in real-time
- Manage PM2 processes and frameworks remotely

## Architecture

```
┌──────────────────────────────┐
│  Server Machine (runs PM2)   │
├──────────────────────────────┤
│  API Server (Express.js)     │
│  - PM2 Service               │
│  - Redis Service             │
│  - System Metrics Service    │
│  - Benchmark Service         │
│  - WebSocket for real-time   │
└──────────────────────────────┘
           ↑ HTTP/WS
           │
┌──────────────────────────────┐
│   Client Machine             │
├──────────────────────────────┤
│  - Dashboard (blessed TUI)   │
│  - Bench.js (remote target)  │
│  - API Client                │
└──────────────────────────────┘
```

## Starting the API Server

### Basic startup
```bash
npm run api:server
```

### Development mode (with error details)
```bash
NODE_ENV=development npm run api:dev
```

### Custom port and host
```bash
API_PORT=8000 API_HOST=192.168.1.100 npm run api:server
```

### With API key authentication
```bash
API_KEY=your-secret-key npm run api:server
```

## Configuration

Environment variables:
- `API_PORT` - Server port (default: 3100)
- `API_HOST` - Server host/bind address (default: 0.0.0.0)
- `API_KEY` - Optional API key for authentication (if not set, auth is disabled)
- `NODE_ENV` - Environment (development, production)

## API Endpoints

### Health Check
```
GET /health
```

Returns server status and uptime.

### PM2 Management

#### Get process stats
```
GET /api/pm2/stats
```

#### Start a framework
```
POST /api/pm2/start
{
  "framework": "express",
  "instances": 4
}
```

#### Stop a framework
```
POST /api/pm2/stop
{
  "framework": "express"
}
```

#### Restart a framework
```
POST /api/pm2/restart
{
  "framework": "express"
}
```

#### Delete a framework
```
POST /api/pm2/delete
{
  "framework": "express"
}
```

#### Delete all processes
```
POST /api/pm2/deleteAll
```

### System Metrics

#### Get system stats (CPU, memory, uptime, load)
```
GET /api/system/stats
```

Returns:
```json
{
  "cpu": 15.5,
  "memory": 2048,
  "totalMemory": 16384,
  "uptime": "2d 3h 45m",
  "loadAvg": "1.23 1.45 1.12",
  "timestamp": "2026-02-09T19:30:00.000Z"
}
```

#### Get CPU usage
```
GET /api/system/cpu
```

#### Get memory info
```
GET /api/system/memory
```

### Redis Management

#### Detect nodes
```
GET /api/redis/nodes
```

#### Get Redis stats
```
GET /api/redis/stats
```

#### Setup Redis cluster
```
POST /api/redis/setup
{
  "nodeCount": 6
}
```

#### Stop Redis
```
POST /api/redis/stop
```

#### Clean Redis
```
POST /api/redis/clean
```

### Benchmarking

#### Get latest results
```
GET /api/benchmark/latest?count=10
```

#### Get all results
```
GET /api/benchmark/all
```

#### Get results by framework
```
GET /api/benchmark/by-framework/express
```

#### Get latest by framework
```
GET /api/benchmark/latest-by-framework
```

#### Run a benchmark
```
POST /api/benchmark/run
{
  "framework": "express",
  "host": "localhost",
  "endpoint": "/simple",
  "method": "GET",
  "duration": 20,
  "instances": 4,
  "connections": 100,
  "pipelining": 10,
  "workers": 8
}
```

Returns 202 Accepted (benchmark runs in background).

#### Get stats
```
GET /api/benchmark/stats
```

#### Reload history
```
POST /api/benchmark/reload
```

#### Clear history
```
DELETE /api/benchmark/clear
```

## WebSocket Connection

Connect to real-time metric streams:

```javascript
const ws = new WebSocket("ws://localhost:3100/ws");

ws.addEventListener("open", () => {
  // Subscribe to system metrics
  ws.send(JSON.stringify({
    type: "subscribe",
    stream: "system:metrics",
    interval: 1000  // Update every 1 second
  }));
  
  // Subscribe to PM2 stats
  ws.send(JSON.stringify({
    type: "subscribe",
    stream: "pm2:stats",
    interval: 2000
  }));
});

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  console.log(message);
});
```

### WebSocket Message Types

**Connection:**
```json
{
  "type": "connected",
  "clientId": "abc123",
  "timestamp": "2026-02-09T19:30:00.000Z"
}
```

**Subscription:**
```json
{
  "type": "subscribed",
  "stream": "system:metrics",
  "timestamp": "2026-02-09T19:30:00.000Z"
}
```

**Metric Update:**
```json
{
  "type": "metric",
  "stream": "system:metrics",
  "data": {
    "cpu": 15.5,
    "memory": 2048,
    ...
  },
  "timestamp": "2026-02-09T19:30:00.000Z"
}
```

**Unsubscription:**
```json
{
  "type": "unsubscribed",
  "stream": "system:metrics",
  "timestamp": "2026-02-09T19:30:00.000Z"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

**Ping/Pong:**
```json
{
  "type": "ping"
}
// Server responds with:
{
  "type": "pong",
  "timestamp": "2026-02-09T19:30:00.000Z"
}
```

## Available Streams

- `system:metrics` - CPU, memory, uptime, load average
- `pm2:stats` - PM2 process information

## Authentication

If `API_KEY` environment variable is set, all requests (except /health and WebSocket upgrade) require the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-secret-key" http://localhost:3100/api/pm2/stats
```

## Using with Remote Bench.js

Run benchmarks from a client machine targeting the server:

```bash
node bench.js -f express -H 192.168.1.100:3001 -d 20 -i 4
```

The bench script will:
1. Execute against the remote framework running on port 3001 of 192.168.1.100
2. Send results back to the API server to be stored in benchmark history
3. Results will be available via `/api/benchmark/latest`

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `202` - Accepted (async operation)
- `400` - Bad request (missing/invalid parameters)
- `401` - Unauthorized (invalid API key)
- `404` - Not found
- `500` - Server error

Error responses include a JSON body:
```json
{
  "error": "Error type",
  "message": "Human-readable error description"
}
```

## Directory Structure

```
api/
├── server.js              # Main Express app and WebSocket server
├── config/
│   └── constants.js       # Configuration constants
├── middleware/
│   ├── auth.js            # API key authentication
│   └── errorHandler.js    # Global error handler
├── routes/
│   ├── pm2.js            # PM2 endpoints
│   ├── redis.js          # Redis endpoints
│   ├── system.js         # System metrics endpoints
│   ├── benchmark.js      # Benchmark endpoints
│   └── websocket.js      # WebSocket handler
├── services/             # Shared services (copied from dashboard)
│   ├── pm2.service.js
│   ├── redis.service.js
│   ├── system.service.js
│   └── benchmark.service.js
└── utils/                # Utilities (copied from dashboard)
    ├── exec.js
    ├── format.js
    └── validators.js
```
