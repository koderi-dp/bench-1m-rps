import express from "express";
import {
  handleSimpleGet,
  handleCodeCreate,
  handleCodeRead,
} from "./handlers.js";

const app = express();

process.title = "node-express";

app.use(express.json({ limit: "1mb" }));

// GET /simple - Simple text response (pure framework overhead test)
app.get(`/simple`, (req, res) => {
  const result = handleSimpleGet();
  res.json(result);
});

// POST /code - Create code with Redis and validation (write performance test)
app.post("/code", async (req, res) => {
  const result = await handleCodeCreate();
  res.status(result.status).json(result.data);
});

// GET /code-fast - Read code from Redis with O(1) lookup (read performance test)
app.get("/code-fast", async (req, res) => {
  const result = await handleCodeRead();
  res.status(result.status).json(result.data);
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    error: "Sorry, something unexpected happened on our side.",
  });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
});
