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

### Adding New Runtimes (C#, Go, Rust, etc.)

The system is **100% runtime-agnostic**. To add a new runtime (C#, Go, Rust, Python, Java, etc.), simply:

1. **Create your server implementation** in `frameworks/<runtime>/`
   - Implement the 3 endpoints: `GET /simple`, `POST /code`, `GET /code-fast`
   - Use the same Redis operations as existing implementations

2. **Add configuration** to `frameworks.config.js`:

```javascript
csharp: {
  name: "csharp",
  displayName: "C# (.NET)",
  port: 3004,
  color: "cyan",
  file: "frameworks/csharp/Server.dll",  // or path to executable
  enabled: true,
  runtime: "dotnet",
  interpreter: "dotnet",                   // Command to run your app
  execMode: "fork",                        // "cluster" (Node.js) or "fork" (most others)
  instances: 1,                            // Instances in cluster mode
},
```

**That's it!** PM2, benchmarking, and the dashboard will work automatically. No need to modify:
- ❌ `ecosystem.config.cjs` (100% dynamic)
- ❌ `pm2.js` (reads from config)
- ❌ `bench.js` (uses port mapping)
- ❌ `dashboard/` (uses `getEnabledFrameworks()`)

**Example: Adding Go**
```javascript
go: {
  name: "go",
  displayName: "Go (Native)",
  port: 3005,
  color: "cyan",
  file: "frameworks/go/server",    // Compiled binary
  enabled: true,
  runtime: "go",
  interpreter: "none",              // No interpreter for compiled binaries
  execMode: "fork",
  instances: 1,
},
```

**Example: Adding Rust**
```javascript
rust: {
  name: "rust",
  displayName: "Rust (Actix)",
  port: 3006,
  color: "red",
  file: "frameworks/rust/target/release/server",  // Compiled binary
  enabled: true,
  runtime: "rust",
  interpreter: "none",
  execMode: "fork",
  instances: 1,
},
```

**Key Properties:**
- `execMode`: Use `"cluster"` for Node.js-style shared sockets, `"fork"` for everything else
- `interpreter`: Command to run your app (`node`, `bun`, `dotnet`, `python`, `java`, etc.)
  - Use `"none"` for compiled binaries (Go, Rust, C++)
- `interpreterPath`: (Optional) Full path if interpreter isn't in PATH
- `instances`: Default instance count (only applies in cluster mode)

**Running Your New Runtime:**
```bash
# Development
bun frameworks/<runtime>/server.ts   # or whatever command

# PM2 (production)
node pm2.js -start -f <name> -i <instances>
node pm2.js -status
pm2 logs <name>

# Benchmarking
node bench.js -f <name> -e /simple -d 10
node bench.js -f <name> -e /code -m POST -d 10

# Or use the interactive menu
npm start
```

---

### Benchmark

Example autocannon run:

```
npx autocannon -m GET --connections 20 --duration 20 --pipelining 2 --workers 6 "http://localhost:3000/simple"
```
