# Overview

This is the main repository used in the [Handling 1 Million Requests per Second video](https://youtu.be/W4EwfEU8CGA).

This version is Redis-only (no PostgreSQL dependency).

## Quick Start

The easiest way to get started is using the **interactive menu**:

```bash
npm start
# or
npm run menu
```

This opens a beautiful terminal UI with:
- 🚀 Quick Start Wizard (auto-setup Redis + Express)
- ⚡ Redis cluster management
- 🚀 PM2 process management  
- 📊 Built-in benchmarks for all frameworks
- 💻 Development server launchers
- ✓ Real-time system status

### Super Quick Start

If you just want everything running now:

```bash
npm run quickstart
```

This automatically:
1. Sets up a 6-node Redis cluster
2. Starts Express with PM2 in production mode
3. Ready to benchmark!

### Setup

To run the code, you need Node.js and Redis installed.

Install dependencies:

```
npm install
```

Run one of the servers:

```
node cpeak.js
```

Or `node express.js` / `node fastify.js`.

Expected startup log:

```
Cpeak server running at http://localhost:3000
[redis] standalone ready.
```

---

### Redis Cluster Mode

Use `redis.sh` to run a local Redis cluster.

Example 6-node cluster:

```
npm run redis:6:setup
```

Then run the app against the cluster:

```
REDIS_CLUSTER=true node express.js
```

Expected log:

```
Express server running at http://localhost:3001
[redis] cluster ready. Total nodes 6 (masters: 3, replicas: 3)
```

Stop/resume/clean:

```
npm run redis:6:stop
npm run redis:6:resume
npm run redis:6:clean
```

---

### Environment Variables

- `REDIS_CLUSTER`: connect to Redis cluster mode when set to `true` (default: `false`).

---

### Node.js Cluster Mode

You can run Node cluster mode with PM2:

```
pm2 start ecosystem.config.cjs
```

By default this starts `cpeak.js`.

To run another framework:

```
F=express pm2 start ecosystem.config.cjs
```

or

```
F=fastify pm2 start ecosystem.config.cjs
```

Check logs:

```
pm2 logs
```

---

### Benchmark

Example autocannon run:

```
npx autocannon -m GET --connections 20 --duration 20 --pipelining 2 --workers 6 "http://localhost:3000/simple"
```
