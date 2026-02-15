---
name: add-framework
description: Step-by-step guide for adding a new runtime or framework to the benchmark suite. Use when the user wants to add a new language (Go, Rust, C#, Python, etc.) or a new Node.js framework (Hono, Koa, etc.) to the benchmarking system.
---

# Add Framework

Add a new runtime or HTTP framework to the node-1m-rps benchmark suite. The system is designed to be extensible — adding a framework requires changes in just 2-3 files and everything else (PM2, benchmarks, dashboard, CLI) picks it up automatically.

## When to Use

- User wants to benchmark a new language/runtime (Go, Rust, C#, Python, Java, etc.)
- User wants to add a new Node.js framework (Hono, Koa, h3, etc.)
- User wants to add a new Bun/Deno framework

## Prerequisites

- The runtime must be installed on the system (e.g., `go`, `dotnet`, `rustc`)
- For Node.js frameworks, just add the npm dependency

## Instructions

### Step 1: Create the Server File

Create the server implementation in `frameworks/<runtime>/`:

**For Node.js frameworks**, create `frameworks/nodejs/<framework>.js`:
- Import shared handlers from `./handlers.js`
- Register routes for all endpoints defined in `api/config/frameworks.config.js`
- The handler pattern returns `{ status, data }` — use `res.status(result.status).send(result.data)`
- Listen on the port defined in frameworks config
- Set `process.title` for PM2/htop identification

Reference the existing Fastify implementation at `frameworks/nodejs/fastify.js` for the pattern.

**For non-Node.js runtimes** (Go, Rust, C#, etc.), create `frameworks/<runtime>/server.<ext>`:
- Implement the same endpoints: `GET /simple`, `POST /code`, `GET /code-fast`
- `GET /simple` must return JSON `{"message": "hi"}`
- `POST /code` and `GET /code-fast` need Redis connectivity (use the runtime's Redis client library)
- Listen on the port defined in frameworks config
- For compiled languages, include build instructions or a Makefile

Reference the existing Bun implementation at `frameworks/bun/bun-native.ts` for a non-Express pattern.

### Step 2: Configure in frameworks.config.js

Add the framework entry to the `FRAMEWORKS` object in `api/config/frameworks.config.js`:

```javascript
myframework: {
  name: "myframework",          // Internal ID (lowercase, no spaces)
  displayName: "My Framework",  // Human-readable name for UI
  port: 3004,                   // Unique port (existing: 3000-3003)
  color: "cyan",                // UI color: green, blue, magenta, yellow, cyan, red, white
  file: "frameworks/<runtime>/server.js",  // Path from project root
  enabled: true,                // Set to true to activate
  runtime: "node",              // Runtime: node, bun, dotnet, go, rust, python, etc.
  interpreter: "node",          // Command to run the file (use "none" for compiled binaries)
  execMode: "cluster",          // "cluster" for Node.js, "fork" for others
  instances: 6,                 // Default PM2 instance count
  // Optional fields:
  // interpreterPath: "/usr/local/bin/node",  // Full path if not in PATH
  // reusePort: true,           // For fork mode with SO_REUSEPORT (Linux only, e.g., Bun)
},
```

**Important configuration rules:**
- `execMode: "cluster"` — Only works with Node.js. Uses Node.js cluster module.
- `execMode: "fork"` — Works with any runtime. Each instance is a separate process.
- `reusePort: true` — Allows multiple fork instances on the same port (requires OS support).
- `interpreter: "none"` — For compiled binaries (Go, Rust, C). PM2 runs the file directly.
- Port must be unique and not conflict with existing frameworks (3000-3003 are taken).

### Step 3: Install Dependencies (if needed)

**For Node.js frameworks:**
```bash
npm install <package-name>
```

**For other runtimes:**
Install the runtime and any dependencies according to that language's package manager.

### Step 4: Verify

After adding the framework:

1. The `rps` CLI will auto-discover it: `npx rps help` (check if it shows up)
2. PM2 commands are auto-generated: `npx rps pm2 <name>`
3. Benchmark commands are auto-generated: `npx rps bench <name>`
4. Dashboard menu will show it under PM2 Cluster and Benchmarks
5. Test manually: start the server, then `curl http://localhost:<port>/simple`

### Example: Adding Hono (Node.js)

1. `npm install hono @hono/node-server`
2. Create `frameworks/nodejs/hono.js` with handlers from `./handlers.js`
3. Add to `FRAMEWORKS` in `api/config/frameworks.config.js`:
   ```javascript
   hono: {
     name: "hono",
     displayName: "Hono",
     port: 3004,
     color: "cyan",
     file: "frameworks/nodejs/hono.js",
     enabled: true,
     runtime: "node",
     interpreter: "node",
     execMode: "cluster",
     instances: 6,
   },
   ```

### Example: Adding Go

1. Create `frameworks/go/` directory
2. Implement server in `frameworks/go/main.go` with `GET /simple`, `POST /code`, `GET /code-fast`
3. Build: `cd frameworks/go && go build -o server`
4. Add to `FRAMEWORKS`:
   ```javascript
   go: {
     name: "go",
     displayName: "Go (Native)",
     port: 3005,
     color: "cyan",
     file: "frameworks/go/server",
     enabled: true,
     runtime: "go",
     interpreter: "none",
     execMode: "fork",
     instances: 1,
   },
   ```

## Common Pitfalls

- **Port conflict**: Check existing ports in `FRAMEWORKS` before assigning a new one
- **Handler consistency**: All frameworks must implement the same endpoints with the same response format
- **Redis cluster**: If using Redis, ensure the framework connects to the cluster (ports 7000+) when `REDIS_CLUSTER=true`
- **PM2 cluster mode**: Only Node.js supports PM2 cluster mode. Use `fork` + `reusePort` for other runtimes
- **Compiled binaries**: Set `interpreter: "none"` — PM2 will execute the file directly
