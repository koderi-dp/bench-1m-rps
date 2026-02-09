import express from "express";
import { createCodeRecord, getRandomCodeRecord } from "./utils.js";

const app = express();

process.title = "node-express";

app.use(express.json({ limit: "1mb" }));

app.get(`/simple`, (req, res) => {
  res.json({ message: "hi" });
});

app.patch(`/update-something/:id/:name`, (req, res) => {
  const { id, name } = req.params;
  const { value1, value2 } = req.query;

  // Validate id and name
  if (isNaN(Number(id))) {
    return res.status(400).json({ error: "id must be a number" });
  } else if (!name || name.length < 3) {
    return res
      .status(400)
      .json({ error: "name is required and must be at least 3 characters" });
  }

  const formattedFooValues = [];

  for (let i = 1; i <= 10; i++) {
    const val = req.body[`foo${i}`];
    const formattedVal = typeof val === "string" ? `${val}. ` : val;
    formattedFooValues.push(formattedVal);
  }

  // Adding all the formatted foo values together
  const totalFoo = formattedFooValues.join("");

  // Generating a few kilobytes of dummy data
  const dummyHistory = Array.from({ length: 100 }).map((_, i) => ({
    event_id: Number(id) + i,
    timestamp: new Date().toISOString(),
    action: `Action performed by ${name}`,
    metadata:
      "This is a string intended to take up space to simulate a medium-sized production API response object.".repeat(
        2,
      ),
    status: i % 2 === 0 ? "success" : "pending",
  }));

  res.json({
    id,
    name,
    value1,
    value2,
    total_foo: String(totalFoo).toUpperCase(),
    history: dummyHistory,
  });
});

// Inserts a simple record in Redis
app.post("/code", async (req, res) => {
  const created = await createCodeRecord();
  if (!created) {
    return res.status(409).json({ error: "Code already exists." });
  }
  res.status(201).json({ created_code: created });
});

// Reads a random code from Redis
app.get("/code-v1", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
});

app.get("/code-v2", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
});

app.get("/code-v3", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
});

app.get("/code-v4", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
});

// Inserts a simple record in Redis
app.post("/code-fast", async (req, res) => {
  const created = await createCodeRecord();
  if (!created) {
    return res.status(409).json({ error: "Code already exists." });
  }
  res.status(201).json({ created_code: created });
});

// Gets a code but through Redis for super fast O(1) lookups
app.get("/code-fast", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
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
