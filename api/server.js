#!/usr/bin/env node

import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { pm2Router } from "./routes/pm2.js";
import { redisRouter } from "./routes/redis.js";
import { systemRouter } from "./routes/system.js";
import { benchmarkRouter } from "./routes/benchmark.js";
import { wsHandler } from "./routes/websocket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const PORT = process.env.API_PORT || 3100;
const HOST = process.env.API_HOST || "0.0.0.0";

// Middleware
app.use(express.json());
app.use(authMiddleware);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use("/api/pm2", pm2Router);
app.use("/api/redis", redisRouter);
app.use("/api/system", systemRouter);
app.use("/api/benchmark", benchmarkRouter);

// WebSocket handler
wss.on("connection", wsHandler);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path
  });
});

// Start server
server.listen(PORT, HOST, () => {
  console.log(`API Server running on http://${HOST}:${PORT}`);
  console.log(`WebSocket available at ws://${HOST}:${PORT}/ws`);
  console.log(`Health check: GET http://${HOST}:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export { app, server, wss };
