import { Pool } from "pg";
import fs from "fs";
import path from "path";
import keys from "./keys.js";

// Create the database if it doesn't exist
async function createDatabase() {
  const adminPool = new Pool({
    user: keys.dbUser,
    host: keys.dbHost,
    database: "postgres", // default DB
    password: keys.dbPassword,
    port: keys.dbPort,
    ssl:
      process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized: false,
          }
        : false,
  });

  const result = await adminPool.query(
    `
    SELECT 1 FROM pg_database WHERE datname = $1
  `,
    [keys.dbDatabase],
  );

  if (result.rowCount === 0) {
    await adminPool.query(`CREATE DATABASE ${keys.dbDatabase};`);
    console.log(`[postgres] created database: ${keys.dbDatabase}`);
  }

  await adminPool.end();
}

await createDatabase();

const pool = new Pool({
  user: keys.dbUser,
  host: keys.dbHost,
  database: keys.dbDatabase,
  password: keys.dbPassword,
  port: keys.dbPort,
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
});

// Test the database connection
try {
  const client = await pool.connect();
  console.log(`[postgres] connected to database: ${keys.dbDatabase}`);
  client.release();
} catch (err) {
  console.error("[postgres] database connection failed:", err);
  process.exit(1);
}

const databasePath = new URL("./", import.meta.url).pathname;

// Create the table(s)
(async () => {
  // Grab the tables sql file
  const codesTableSQL = fs
    .readFileSync(path.join(databasePath, "./tables/codes.sql"))
    .toString();

  try {
    // Drop all our tables
    console.log("\nDropping the tables...");
    await pool.query("DROP TABLE IF EXISTS codes");
    console.log("[postgres] codes table was dropped.");

    // Execute the sql file to create our tables
    console.log("\nCreating the tables...");
    await pool.query(codesTableSQL);
    console.log("[postgres] codes table was created successfully.");
  } catch (err) {
    console.error(err);
  }
})();
