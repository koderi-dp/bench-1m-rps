---
name: manage-pm2
description: Guide for managing PM2 processes in the node-1m-rps project. Use when the user needs to start, stop, restart, or delete framework instances, check process status, view logs, or troubleshoot PM2 issues.
---

# Manage PM2 Processes

Manage framework server processes using PM2. PM2 handles clustering, process monitoring, and automatic restarts for all benchmark framework servers.

## When to Use

- User wants to start/stop/restart framework servers
- User needs to check process status or view logs
- User is troubleshooting PM2 or framework startup issues
- User needs to scale instances up or down

## PM2 Operations

### Via Dashboard (Recommended)

1. Start dashboard: `npm run client`
2. Press **m** for menu
3. Navigate to **PM2 Cluster** section
4. Available actions:
   - Start each framework (prompts for instance count)
   - Stop All / Restart All / Delete All

### Via CLI Scripts

```bash
# Start a framework
node api/scripts/pm2.js -start -f fastify -i 10    # Fastify with 10 instances
node api/scripts/pm2.js -start -f bun -i 10         # Bun with 10 instances
node api/scripts/pm2.js -start -f express -i 6       # Express with 6 instances

# Stop a framework
node api/scripts/pm2.js -stop -f fastify

# Stop all
node api/scripts/pm2.js -stop

# Delete all
node api/scripts/pm2.js -delete

# Restart all
node api/scripts/pm2.js -restart

# View status
node api/scripts/pm2.js -status

# View logs
node api/scripts/pm2.js -logs
```

### Via RPS CLI

```bash
npx rps pm2 fastify    # Start Fastify (default instances)
npx rps pm2 bun        # Start Bun (default instances)
npx rps pm2 stop       # Stop all
npx rps pm2 restart    # Restart all
npx rps pm2 delete     # Delete all
npx rps pm2 status     # View status
npx rps pm2 logs       # View logs
```

### Via API

```bash
# Start framework
curl -X POST http://localhost:3100/api/pm2/start \
  -H "Content-Type: application/json" \
  -d '{"framework": "fastify", "instances": 10}'

# Stop framework
curl -X POST http://localhost:3100/api/pm2/stop \
  -H "Content-Type: application/json" \
  -d '{"framework": "fastify"}'

# Restart framework
curl -X POST http://localhost:3100/api/pm2/restart \
  -H "Content-Type: application/json" \
  -d '{"framework": "fastify"}'

# Delete framework
curl -X POST http://localhost:3100/api/pm2/delete \
  -H "Content-Type: application/json" \
  -d '{"framework": "fastify"}'

# Stop/Restart/Delete all
curl -X POST http://localhost:3100/api/pm2/stopAll
curl -X POST http://localhost:3100/api/pm2/restartAll
curl -X POST http://localhost:3100/api/pm2/deleteAll

# Get stats
curl http://localhost:3100/api/pm2/stats
```

## Execution Modes

| Mode | Runtime | How it Works |
|------|---------|-------------|
| `cluster` | Node.js only | Uses Node.js cluster module. Multiple workers share one port. |
| `fork` | Any runtime | Each instance is a separate OS process. |
| `fork` + `reusePort` | Linux (Bun, Go) | Fork mode but multiple instances share one port via SO_REUSEPORT. |

**Current framework defaults** (from `api/config/frameworks.config.js`):
- **Fastify**: cluster mode, 10 instances, port 3002
- **Bun**: fork mode + reusePort, 10 instances, port 3003
- **Express**: cluster mode, 6 instances, port 3001 (disabled by default)
- **Cpeak**: cluster mode, 6 instances, port 3000 (disabled by default)

## Instance Count Guidelines

- Match to available CPU cores minus 2 (reserve for Redis + system)
- For benchmarking: 10 instances is a good starting point on 12+ core systems
- For development/testing: 1-3 instances is sufficient
- The dashboard prompts for instance count when starting via menu

## Code Files

| File | Purpose |
|------|---------|
| `api/scripts/pm2.js` | CLI script for PM2 management |
| `api/services/pm2.service.js` | API service (start, stop, stats) |
| `api/routes/pm2.js` | API routes for PM2 operations |
| `api/config/frameworks.config.js` | Framework definitions (ports, modes, instances) |
| `api/config/ecosystem.config.cjs` | PM2 ecosystem configuration |

## Troubleshooting

### "PM2 not found"
- Install PM2 globally: `npm install -g pm2`

### Framework not starting
- Check if the port is already in use: `lsof -i :<port>` or `ss -tlnp | grep <port>`
- Check PM2 logs: `pm2 logs <framework-name>`
- Verify the framework is enabled in `api/config/frameworks.config.js`

### "Error loading PM2" / timeout
- Too many processes may cause timeouts
- Try: `pm2 delete all` then start fresh

### Bun instances not sharing port
- `reusePort: true` only works on Linux (not macOS/Windows/WSL1)
- On WSL2, it should work. On macOS, use a single instance.

### Process shows "errored" status
- Check logs: `pm2 logs <name> --err`
- Common causes: missing dependencies, port conflict, Redis not available

### Scaling instances
- Stop and restart with new instance count:
  ```bash
  node api/scripts/pm2.js -stop -f fastify
  node api/scripts/pm2.js -start -f fastify -i 12
  ```
- Or use `pm2 scale <name> <count>` for Node.js cluster mode
