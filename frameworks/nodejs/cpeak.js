import cpeak, { parseJSON } from "cpeak";
import {
  handleSimpleGet,
  handleCodeCreate,
  handleCodeRead,
  handleCodeUltraFastCreate,
} from "./handlers.js";

const app = cpeak();

process.title = "node-cpeak";

app.beforeEach(parseJSON({ limit: 1024 * 1024 }));

// GET /simple - Simple text response (pure framework overhead test)
app.route("get", `/simple`, (req, res) => {
  const result = handleSimpleGet();
  res.json(result);
});

// POST /code - Create code with Redis and validation (write performance test)
app.route("post", "/code", async (req, res) => {
  const result = await handleCodeCreate();
  res.status(result.status).json(result.data);
});

// GET /code-fast - Read code from Redis with O(1) lookup (read performance test)
app.route("get", "/code-fast", async (req, res) => {
  const result = await handleCodeRead();
  res.status(result.status).json(result.data);
});

// POST /code-ultra-fast - Ultra-fast code creation (maximum write throughput test, Cpeak only)
app.route("post", "/code-ultra-fast", async (req, res) => {
  const result = await handleCodeUltraFastCreate();
  res.status(result.status).json(result.data);
});

app.handleErr((error, req, res) => {
  console.error(error);
  res.status(500).json({
    error: "Sorry, something unexpected happened on our side.",
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Cpeak server running at http://localhost:${PORT}`);
});
