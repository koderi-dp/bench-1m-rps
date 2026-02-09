import Fastify from "fastify";
import {
  handleSimpleGet,
  handleCodeCreate,
  handleCodeRead,
} from "./handlers.js";

const app = Fastify({ bodyLimit: 1024 * 1024 });

process.title = "node-fastify";

// GET /simple - Simple text response (pure framework overhead test)
app.get(`/simple`, (req, res) => {
  const result = handleSimpleGet();
  res.send(result);
});

// POST /code - Create code with Redis and validation (write performance test)
app.post("/code", async (req, res) => {
  const result = await handleCodeCreate();
  res.status(result.status).send(result.data);
});

// GET /code-fast - Read code from Redis with O(1) lookup (read performance test)
app.get("/code-fast", async (req, res) => {
  const result = await handleCodeRead();
  res.status(result.status).send(result.data);
});

app.setErrorHandler((err, req, res) => {
  console.error("Unhandled error:", err);
  res.status(500).send({ error: "Internal Server Error" });
});

const PORT = 3002;
app.listen({ port: PORT, host: "0.0.0.0" }, () => {
  console.log(`Fastify server running at http://localhost:${PORT}`);
});
