import cpeak, { parseJSON } from "cpeak";
import Redis from "ioredis";
import crypto from "crypto";
import { DB } from "./database/index.js";

const app = cpeak();
const redis = new Redis();

process.title = "node-cpeak";

app.beforeEach(parseJSON({ limit: 1024 * 1024 }));

const generateCode = () => {
  // 375 random bytes becomes 500 Base64 characters
  return crypto.randomBytes(375).toString("base64").substring(0, 500);
};

/*

autocannon -m GET \
  -c 5 -d 20 -p 2 --workers 1 \
  "http://localhost:3000/simple"

*/

app.route("get", `/simple`, async (req, res) => {
  await res.json({ message: "hi" });
});

/*

autocannon -m PATCH \
  -c 5 -d 20 -p 2 --workers 1 \
  -H "Content-Type: application/json" \
  -b '{"foo1":"test","foo2":"test","foo3":"test","foo4":"test","foo5":"test","foo6":"test","foo7":"test","foo8":"test","foo9":"test","foo10":"test"}' \
  "http://localhost:3000/update-something/123/john_doe?value1=abc&value2=xyz"

*/

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

/*

autocannon -m POST \
  -c 5 -d 20 -p 2 --workers 1 \
  "http://localhost:3000/code"

*/

// Inserts a simple record to the database
app.route("post", "/code", async (req, res, handleErr) => {
  const code = generateCode();

  // Create a new code record
  try {
    const result = await DB.query(
      `
      INSERT INTO codes (code)
      VALUES ($1)
      RETURNING id, code, created_at
    `,
      [code],
    );

    res.status(201).json({ created_code: result[0] });
  } catch (err) {
    if (err.code === "23505") {
      // Unique violation
      return res.status(409).json({ error: "Code already exists." });
    }
    return handleErr(err);
  }
});

/*

autocannon -m GET \
  -c 5 -d 20 -p 2 --workers 1 \
  "http://localhost:3000/code"

*/

// Reads a simple random code from the database and returns it
app.route("get", "/code-v1", async (req, res, handleErr) => {
  try {
    const result = await DB.query(
      `
      SELECT id, code, created_at
      FROM codes
      ORDER BY RANDOM()
      LIMIT 1
    `,
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "No codes found." });
    }

    res.json({ data: result[0] });
  } catch (err) {
    return handleErr(err);
  }
});

app.route("get", "/code-v2", async (req, res, handleErr) => {
  try {
    const countResult = await DB.query(`SELECT COUNT(*) FROM codes`);
    const count = parseInt(countResult[0].count, 10);

    if (count === 0) return res.status(404).json({ error: "No codes found." });

    // Generate a random ID between 1 and Count
    const randomId = crypto.randomInt(1, count + 1);

    // Fetch the record by ID (Index Lookup)
    const result = await DB.query(
      `
      SELECT id, code, created_at
      FROM codes
      WHERE id = $1
    `,
      [randomId],
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "record not found" });
    }

    res.json({ data: result[0] });
  } catch (err) {
    return handleErr(err);
  }
});

app.route("get", "/code-v3", async (req, res, handleErr) => {
  try {
    const maxResult = await DB.query(
      `SELECT id FROM codes ORDER BY id DESC LIMIT 1`,
    );

    if (maxResult.length === 0)
      return res.status(404).json({ error: "No codes found." });

    const maxId = maxResult[0].id;

    // Generate random ID up to Max
    const randomId = crypto.randomInt(1, maxId + 1);

    // Fetch (Index Lookup)
    const result = await DB.query(
      `SELECT id, code, created_at FROM codes WHERE id = $1`,
      [randomId],
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "record not found" });
    }

    res.json({ data: result[0] });
  } catch (err) {
    return handleErr(err);
  }
});

app.route("get", "/code-v4", async (req, res, handleErr) => {
  try {
    const randomId = crypto.randomInt(1, 700000 + 1);

    // Fetch the record by ID (Index Lookup)
    const result = await DB.query(
      `
      SELECT id, code, created_at
      FROM codes
      WHERE id = $1
    `,
      [randomId],
    );

    if (result.length === 0) {
      return res.status(404).json({ error: "record not found" });
    }

    res.json({ data: result[0] });
  } catch (err) {
    return handleErr(err);
  }
});

// Inserts a simple record to the database through Redis for super fast O(1) operations
app.route("post", "/code-fast", async (req, res, handleErr) => {
  const code = generateCode();

  try {
    // Check uniqueness (O(1))
    // SADD returns 1 if added (new), 0 if exists (duplicate)
    const isNew = await redis.sadd("codes:unique", code);

    if (isNew === 0) {
      return res.status(409).json({ error: "Code already exists." });
    }

    // Generate ID (Incrementing Sequence O(1))
    const id = await redis.incr("codes:seq");
    const created_at = new Date().toISOString();

    // Store Data (O(1) Hash Set)
    await redis.hset(`code:${id}`, { id, code, created_at });

    res.status(201).json({
      created_code: { id, code, created_at },
    });
  } catch (err) {
    return handleErr(err);
  }
});

// Gets a code but through Redis for super fast O(1) lookups
app.route("get", "/code-fast", async (req, res, handleErr) => {
  try {
    // Get max ID
    const maxIdStr = await redis.get("codes:seq");
    if (!maxIdStr) return res.status(404).json({ error: "No codes found." });

    const maxId = parseInt(maxIdStr, 10);

    // Generating a random ID
    const randomId = crypto.randomInt(1, maxId + 1);

    // Fetch the code (O(1) Hash Lookup)
    const result = await redis.hgetall(`code:${randomId}`);

    if (Object.keys(result).length === 0) {
      return res.status(404).json({ error: "record not found" });
    }

    res.json({ data: result });
  } catch (err) {
    return handleErr(err);
  }
});

app.handleErr((err, req, res) => {
  if (err.cpeak_err) {
    console.log(err);
    return res.status(err.status || 400).json({ error: err.message });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Cpeak server running at http://localhost:${PORT}`);
});
