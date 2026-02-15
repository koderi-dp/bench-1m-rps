import Redis from "ioredis";

const isCluster = process.env.REDIS_CLUSTER === "true";

// REDIS_HOST: connect to remote Redis (default 127.0.0.1)
// When REDIS_AGENT_URL is set, derive host from it if REDIS_HOST not set
const agentUrl = process.env.REDIS_AGENT_URL;
const redisHost =
  process.env.REDIS_HOST ||
  (agentUrl ? new URL(agentUrl).hostname : "127.0.0.1");
const defaultPort = isCluster ? 7000 : 6379;
const redisPort = parseInt(process.env.REDIS_PORT || String(defaultPort), 10);

// For cluster on remote host: Redis may report 127.0.0.1 in CLUSTER NODES;
// natMap maps those to the actual host we can reach
const natMap =
  redisHost !== "127.0.0.1"
    ? Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => {
          const port = 7000 + i;
          return [`127.0.0.1:${port}`, { host: redisHost, port }];
        })
      )
    : undefined;

const redis = isCluster
  ? new Redis.Cluster([{ host: redisHost, port: redisPort }], { natMap })
  : new Redis({ host: redisHost, port: redisPort });

redis.on("ready", () => {
  if (isCluster) {
    console.log(
      `[redis] cluster ready. Total nodes ${redis.nodes().length} (masters: ${redis.nodes("master").length}, replicas: ${redis.nodes("slave").length})`,
    );
  } else {
    console.log("[redis] standalone ready.");
  }
});

redis.on("error", (err) => {
  console.error("Redis Error:", err.message);
});

export { redis };
