import { serve } from "bun";
import {
  handleSimpleGet,
  handleCodeCreate,
  handleCodeRead,
} from "./handlers";

/**
 * Bun Native HTTP Server
 * 
 * Uses Bun.serve() for maximum performance with zero framework overhead.
 * Implements the same endpoints as Node.js frameworks for fair comparison.
 */

const server = serve({
  port: 3003,
  hostname: "0.0.0.0",
  reusePort: true, // Allow multiple processes to share the same port (Linux SO_REUSEPORT)
  
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    
    try {
      // GET /simple - Simple text response (pure framework overhead test)
      if (url.pathname === "/simple" && req.method === "GET") {
        const result = handleSimpleGet();
        return Response.json(result);
      }
      
      // POST /code - Create code with Redis and validation (write performance test)
      if (url.pathname === "/code" && req.method === "POST") {
        const result = await handleCodeCreate();
        return Response.json(result.data, { status: result.status });
      }
      
      // GET /code-fast - Read code from Redis with O(1) lookup (read performance test)
      if (url.pathname === "/code-fast" && req.method === "GET") {
        const result = await handleCodeRead();
        return Response.json(result.data, { status: result.status });
      }
      
      // 404 - Not Found
      return Response.json(
        { error: `Cannot ${req.method} ${url.pathname}` },
        { status: 404 }
      );
      
    } catch (error) {
      console.error("Unhandled error:", error);
      return Response.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  },
  
  error(error: Error): Response {
    console.error("Server error:", error);
    return Response.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  },
});

// Set process title for easier identification in PM2/htop
process.title = "bun-native";

console.log(`Bun Native server running at http://localhost:${server.port}`);
console.log(`Process: ${process.title}`);
