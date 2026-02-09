import cpeak, { parseJSON } from "cpeak";
import crypto from "crypto";
import { redis } from "./database/redis.js";
import {
  createCodeRecord,
  generateCode,
  getRandomCodeRecord,
} from "./utils.js";

const app = cpeak();

process.title = "node-cpeak";

app.beforeEach(parseJSON({ limit: 1024 * 1024 }));

app.route("get", `/simple`, (req, res) => {
  res.json({ message: "hi" });
});

app.route("patch", `/update-something/:id/:name`, (req, res) => {
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
app.route("post", "/code", async (req, res) => {
  const created = await createCodeRecord();
  if (!created) {
    return res.status(409).json({ error: "Code already exists." });
  }
  res.status(201).json({ created_code: created });
});

// Reads a random code from Redis
app.route("get", "/code-v1", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
});

app.route("get", "/code-v2", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
});

app.route("get", "/code-v3", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
});

app.route("get", "/code-v4", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
});

// Inserts a simple record in Redis
app.route("post", "/code-fast", async (req, res) => {
  const created = await createCodeRecord();
  if (!created) {
    return res.status(409).json({ error: "Code already exists." });
  }
  res.status(201).json({ created_code: created });
});

app.route("post", "/code-ultra-fast", async (req, res) => {
  /**
   * We won't bother with id uniqueness here because at a rate of 1 million
   * requests per second, it would take approximately 86,000 years to reach a 50%
   * probability of at least one id duplicate.
   *
   *
   * The math is based on the birthday paradox problem approximation:
   * P(collision) ≈ 1 - e^(-n²/(2N))
   *
   * Where:
   * n = number of UUIDs generated
   * N = total possible UUIDs = 2^122
   * e = Euler's number (≈ 2.71828)
   *
   * For 50% collision probability, we solve:
   * 0.5 = 1 - e^(-n²/(2×2^122))
   *
   * This gives n ≈ 2.7×10^18 UUIDs. At 1 million UUIDs per second, this would take:
   *
   * Time (seconds) = n / 1,000,000 = 2.7×10^12 seconds
   * Time (years) = 2.7×10^12 / (60×60×24×365) ≈ 86,000 years.
   *
   * Thus, for all practical purposes, we can consider UUID collisions negligible
   * in this context.
   */
  const id = crypto.randomUUID(); // generates a 122-bit random UUID

  const code = generateCode();
  const created_at = new Date().toISOString();

  const record = JSON.stringify({ id, code, created_at });

  await redis.set(`code:{${id}}`, record);

  // Keep queue sharded for high write throughput
  const shard = Math.floor(Math.random() * 100) + 1;
  await redis.lpush(`codes:sync_queue:{${shard}}`, id);

  res.status(201).json({ created_code: { id, code, created_at } });
});

// Gets a code but through Redis for super fast O(1) lookups
app.route("get", "/code-fast", async (req, res) => {
  const result = await getRandomCodeRecord();
  if (!result) {
    return res.status(404).json({ error: "No codes found." });
  }
  res.json({ data: result });
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
