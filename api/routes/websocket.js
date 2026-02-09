import { SystemService } from "../services/system.service.js";
import { PM2Service } from "../services/pm2.service.js";

const systemService = new SystemService();
const pm2Service = new PM2Service();

// Track active WebSocket connections
const activeConnections = new Set();

/**
 * WebSocket handler for real-time metrics streaming
 */
export async function wsHandler(ws, req) {
  const clientId = Math.random().toString(36).substr(2, 9);
  const subscriptions = new Set();

  console.log(`[WS] Client connected: ${clientId}`);
  activeConnections.add(ws);

  // Send initial connection message
  ws.send(JSON.stringify({
    type: "connected",
    clientId,
    timestamp: new Date().toISOString()
  }));

  // Handle incoming messages
  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case "subscribe":
          handleSubscribe(ws, message, subscriptions, clientId);
          break;
        case "unsubscribe":
          handleUnsubscribe(ws, message, subscriptions, clientId);
          break;
        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
          break;
        default:
          ws.send(JSON.stringify({
            type: "error",
            message: `Unknown message type: ${message.type}`
          }));
      }
    } catch (error) {
      console.error(`[WS] Error handling message from ${clientId}:`, error);
      ws.send(JSON.stringify({
        type: "error",
        message: error.message
      }));
    }
  });

  // Handle client disconnect
  ws.on("close", () => {
    console.log(`[WS] Client disconnected: ${clientId}`);
    activeConnections.delete(ws);
    subscriptions.clear();
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`[WS] Error from client ${clientId}:`, error);
  });
}

/**
 * Handle subscription to a metric stream
 */
function handleSubscribe(ws, message, subscriptions, clientId) {
  const { stream, interval = 1000 } = message;

  if (!stream) {
    ws.send(JSON.stringify({
      type: "error",
      message: "Missing 'stream' field in subscription"
    }));
    return;
  }

  if (subscriptions.has(stream)) {
    ws.send(JSON.stringify({
      type: "subscribed",
      stream,
      message: "Already subscribed to this stream"
    }));
    return;
  }

  subscriptions.add(stream);
  
  ws.send(JSON.stringify({
    type: "subscribed",
    stream,
    timestamp: new Date().toISOString()
  }));

  // Start streaming updates
  streamMetrics(ws, stream, interval, subscriptions);
}

/**
 * Handle unsubscription from a metric stream
 */
function handleUnsubscribe(ws, message, subscriptions, clientId) {
  const { stream } = message;

  if (!stream) {
    ws.send(JSON.stringify({
      type: "error",
      message: "Missing 'stream' field in unsubscription"
    }));
    return;
  }

  subscriptions.delete(stream);
  
  ws.send(JSON.stringify({
    type: "unsubscribed",
    stream,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Stream metrics to WebSocket client
 */
async function streamMetrics(ws, stream, interval, subscriptions) {
  // Check if still subscribed and connection is open
  if (!subscriptions.has(stream) || ws.readyState !== ws.OPEN) {
    return;
  }

  try {
    let data;

    switch (stream) {
      case "system:metrics":
        data = await systemService.getStats();
        break;
      case "pm2:stats":
        data = await pm2Service.getStats();
        break;
      default:
        return;
    }

    // Only send if still subscribed and connection is open
    if (subscriptions.has(stream) && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: "metric",
        stream,
        data,
        timestamp: new Date().toISOString()
      }));
    }

    // Schedule next update
    if (subscriptions.has(stream) && ws.readyState === ws.OPEN) {
      setTimeout(() => streamMetrics(ws, stream, interval, subscriptions), interval);
    }
  } catch (error) {
    console.error(`[WS] Error streaming ${stream}:`, error);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: "error",
        stream,
        message: error.message
      }));
    }
  }
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastToAll(message) {
  const payload = JSON.stringify(message);
  activeConnections.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  });
}

/**
 * Broadcast to clients subscribed to specific stream
 */
export function broadcastToStream(stream, data) {
  const message = {
    type: "metric",
    stream,
    data,
    timestamp: new Date().toISOString()
  };
  broadcastToAll(message);
}
