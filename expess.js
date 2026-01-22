import express from "express";

const app = express();

process.title = "node-express";

app.use(express.json());

app.get(`/simple`, (req, res) => {
  res.send("hi");
});

/*

autocannon -m PATCH \
  -c 10 -d 20 -p 10 --workers 1 \
  -H "Content-Type: application/json" \
  -b '{"foo1":"test","foo2":"test","foo3":"test","foo4":"test","foo5":"test","foo6":"test","foo7":"test","foo8":"test","foo9":"test","foo10":"test"}' \
  "http://localhost:3001/update-something/123/john_doe?value1=abc&value2=xyz"

*/

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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
});
