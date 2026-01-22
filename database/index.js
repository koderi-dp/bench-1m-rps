import pkg from "pg";
import keys from "./keys.js";

export const pool = new pkg.Pool({
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

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("[postgres] connection failed.");
    console.error("Error details:\n", err);
    process.exit(1);
  } else {
    console.log("[postgres] connected successfully to " + keys.dbDatabase);
  }
});

// For any general query
const query = (query, values) => {
  return new Promise(function (resolve, reject) {
    pool.query(query, values, function (err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res.rows);
      }
    });
  });
};

export const DB = {
  query,
};
