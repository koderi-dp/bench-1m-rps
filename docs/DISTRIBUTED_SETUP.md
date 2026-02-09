# Distributed Architecture Setup

Your application now supports a distributed client-server architecture. This allows you to:

- **Run PM2 and frameworks on one server machine**
- **Run the dashboard on a different client machine**
- **Run benchmarks from a remote client**
- **Monitor everything in real-time over HTTP/WebSocket**

## Architecture

```
┌─────────────────────────────────┐
│   Server Machine (PM2 running)  │
├─────────────────────────────────┤
│  API Server (port 3100)         │
│  ├─ PM2Service                  │
│  ├─ RedisService                │
│  ├─ SystemService               │
│  ├─ BenchmarkService            │
│  └─ WebSocket Handler           │
│                                 │
│  $ npm run api:server           │
└─────────────────────────────────┘
         ↑ HTTP/WebSocket
         │ (REST API + WS)
         │
┌─────────────────────────────────┐
│   Client Machine(s)             │
├─────────────────────────────────┤
│  Dashboard (blessed TUI)        │
│  ├─ API Client (HTTP/WS)        │
│  ├─ UI Widgets                  │
│  └─ Controllers                 │
│                                 │
│  $ API_SERVER=... npm run ...   │
└─────────────────────────────────┘
```

## Setup Instructions

### Server Setup (where PM2 runs)

**1. Start the API Server**
```bash
npm run api:server
```

**Output:**
```
API Server running on http://0.0.0.0:3100
WebSocket available at ws://0.0.0.0:3100/ws
Health check: GET http://0.0.0.0:3100/health
```

**With custom configuration:**
```bash
# Custom port
API_PORT=8000 npm run api:server

# With authentication
API_KEY=your-secret-key npm run api:server

# Development mode with detailed errors
NODE_ENV=development npm run api:dev

# Specific host binding
API_HOST=192.168.1.100 npm run api:server
```

### Client Setup (where dashboard runs)

**1. Point dashboard to remote API server**
```bash
API_SERVER=http://192.168.1.100:3100 npm run dashboard
```

**If API server requires authentication:**
```bash
API_SERVER=http://192.168.1.100:3100 API_KEY=your-secret-key npm run dashboard
```

**Local development (same machine):**
```bash
# Terminal 1: API Server
npm run api:server

# Terminal 2: Dashboard (defaults to localhost:3100)
npm run dashboard
```

## Key Files

### New Files (Client-Server Communication)

- **`api/server.js`** - Main API server with Express
- **`api/config/constants.js`** - Server configuration
- **`api/middleware/auth.js`** - API key authentication
- **`api/middleware/errorHandler.js`** - Error handling
- **`api/routes/pm2.js`** - PM2 API endpoints
- **`api/routes/redis.js`** - Redis API endpoints
- **`api/routes/system.js`** - System metrics API endpoints
- **`api/routes/benchmark.js`** - Benchmark API endpoints
- **`api/routes/websocket.js`** - WebSocket real-time handler
- **`api/services/`** - Core services (moved from dashboard)

- **`dashboard/services/api.client.js`** - Client library for API communication
- **`dashboard/services/adapters.js`** - Service adapters (translate API to local interface)

### Unchanged Files

- **`dashboard/ui/`** - All UI widgets (blessed components) - unchanged
- **`dashboard/controllers/`** - Command and update logic - modified to use adapters
- **`dashboard/utils/`** - Formatting and utilities - unchanged
- **`dashboard/state/`** - Local state management - unchanged

## Architecture Comparison

### Before (Monolithic)
```
Dashboard
├─ Services (local)
│  ├─ PM2Service
│  ├─ RedisService
│  ├─ SystemService
│  └─ BenchmarkService
└─ UI (blessed)
```

### After (Distributed)
```
Server:
├─ API Server
│  ├─ Services (PM2, Redis, System, Benchmark)
│  └─ WebSocket

Client:
├─ API Client (HTTP + WebSocket)
├─ Service Adapters (local interface)
└─ UI (blessed)
```

## API Endpoints

The server exposes REST endpoints for all operations:

### PM2 Management
- `GET /api/pm2/stats` - Get process statistics
- `POST /api/pm2/start` - Start framework
- `POST /api/pm2/stop` - Stop framework
- `POST /api/pm2/restart` - Restart framework
- `POST /api/pm2/delete` - Delete framework
- `POST /api/pm2/deleteAll` - Delete all processes

### System Metrics
- `GET /api/system/stats` - CPU, memory, uptime, load
- `GET /api/system/cpu` - CPU percentage
- `GET /api/system/memory` - Memory information

### Redis
- `GET /api/redis/nodes` - Detect cluster nodes
- `GET /api/redis/stats` - Get cluster stats
- `POST /api/redis/setup` - Setup cluster
- `POST /api/redis/stop` - Stop cluster
- `POST /api/redis/clean` - Clean cluster

### Benchmarking
- `GET /api/benchmark/latest?count=10` - Latest results
- `GET /api/benchmark/all` - All results
- `GET /api/benchmark/by-framework/:framework` - Framework results
- `POST /api/benchmark/run` - Run benchmark
- `GET /api/benchmark/stats` - Statistics
- `DELETE /api/benchmark/clear` - Clear history

### Health & Status
- `GET /health` - Server health check
- `WS /ws` - WebSocket connection for real-time updates

See `API_SERVER.md` for detailed API documentation.

## WebSocket Real-time Streaming

The client can subscribe to real-time metric updates:

```javascript
const apiClient = new APIClient("http://localhost:3100");

// Connect to WebSocket
await apiClient.connectWebSocket();

// Set up callbacks
apiClient.onMetric((stream, data, timestamp) => {
  console.log(`Received ${stream}:`, data);
});

// Subscribe to streams
apiClient.subscribeToStream("system:metrics", 1000);   // Every 1 second
apiClient.subscribeToStream("pm2:stats", 2000);        // Every 2 seconds

// Later: unsubscribe
apiClient.unsubscribeFromStream("system:metrics");
```

## Remote Benchmarking

Run benchmarks from a client machine against a remote server:

```bash
node bench.js -f fastify -H 192.168.1.100:3001 -d 20 -i 4
```

This:
1. Targets the Fastify server running on 192.168.1.100:3001
2. Sends results to the API server (192.168.1.100:3100)
3. Results are stored in benchmark history and accessible via API

## Authentication

Optional API key protection:

**Server side:**
```bash
API_KEY=my-secret-key npm run api:server
```

**Client side:**
```bash
API_KEY=my-secret-key npm run dashboard
```

Or with curl:
```bash
curl -H "X-API-Key: my-secret-key" http://localhost:3100/api/pm2/stats
```

## Error Handling

The client gracefully handles:
- **Connection refused** - Server not running
- **Timeouts** - Slow network
- **401 Unauthorized** - Invalid API key
- **Network errors** - Automatic reconnect for WebSocket

All errors are logged to console with `[ERROR]` prefix.

## Performance Considerations

- **Dashboard polling intervals:**
  - Fast: 1 second (CPU, memory, PM2)
  - Slow: 5 seconds (uptime, load average)

- **Network overhead:**
  - Minimal JSON payloads
  - WebSocket for efficient real-time updates
  - HTTP/2 support when available

- **Remote operations:**
  - PM2 operations run locally on server
  - Benchmarks execute locally on server
  - Results sent back to client asynchronously

## Troubleshooting

**Dashboard says "Cannot connect to API server"**
- Check API server is running: `curl http://localhost:3100/health`
- Check firewall allows port 3100
- Check API_SERVER environment variable points to correct IP:port

**API server says "PM2 timeout"**
- Too many PM2 processes, increase timeout in `api/config/constants.js`
- Or reduce PM2 process count

**Benchmarks not appearing in history**
- Ensure bench.js is running on same machine as API server
- Check benchmark results are written to `.bench-history.json`

**WebSocket disconnects frequently**
- Check network stability
- Increase WebSocket reconnect interval in `api/routes/websocket.js`

## Environment Variables

### Server
- `API_PORT` - Server port (default: 3100)
- `API_HOST` - Bind address (default: 0.0.0.0)
- `API_KEY` - Optional authentication key
- `NODE_ENV` - Environment mode (development/production)

### Client (Dashboard)
- `API_SERVER` - API server URL (default: http://localhost:3100)
- `API_KEY` - Authentication key (if server requires it)

## Multiple Clients

The API server can serve multiple dashboard clients simultaneously:

```
Server (192.168.1.100):
$ npm run api:server

Client 1 (192.168.1.50):
$ API_SERVER=http://192.168.1.100:3100 npm run dashboard

Client 2 (192.168.1.60):
$ API_SERVER=http://192.168.1.100:3100 npm run dashboard
```

Each client:
- Connects independently to the API
- Maintains its own UI state
- Gets real-time updates via WebSocket
- Can execute commands remotely

## Migration from Monolithic

If you have existing PM2 processes and benchmark history:

1. **Keep all existing processes running** - API server just reads from PM2
2. **Start API server** - `npm run api:server`
3. **Start dashboard with API** - `API_SERVER=... npm run dashboard`
4. **Benchmark history** - Automatically discovered from `.bench-history.json`

No data migration needed - everything works together!

## Next Steps

- Use `API_SERVER=http://remote-ip:3100 npm run dashboard` from any machine
- Create PM2 ecosystem.config.js for API server startup
- Configure firewall for remote access
- Add monitoring/alerting on top of API
- Build other clients (web, CLI, mobile) using the same API
