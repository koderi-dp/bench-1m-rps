module.exports = {
  apps: [
    {
      name: process.env.F || "cpeak",
      script: `./${process.env.F || "cpeak"}.js`,
      instances: parseInt(process.env.I) || 6,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        REDIS_CLUSTER: "true",
      },
    },
  ],
};
