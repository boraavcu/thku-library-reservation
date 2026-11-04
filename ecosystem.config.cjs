const port = process.env.BACKEND_PORT;

if (!port || !/^\d+$/.test(String(port))) {
  console.error("BACKEND_PORT tanımlı değil. Sunucuda boş olan portu seçip set BACKEND_PORT=PORT yazın.");
  process.exit(1);
}

module.exports = {
  apps: [
    {
      name: "thku-randevu-api",
      cwd: "./backend",
      script: "node_modules/next/dist/bin/next",
      args: `start -H 127.0.0.1 -p ${port}`,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
