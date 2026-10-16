import { createApp } from "./app.js";
import { pool } from "./db.js";
import { getServerConfig } from "./env.js";

const config = getServerConfig();
const app = createApp({
  pool,
  jwtSecret: config.jwtSecret,
  frontendOrigin: config.frontendOrigin,
  secureCookie: config.secureCookie,
});

const server = app.listen(config.port, () => console.log(`Student Management API listening on port ${config.port}.`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  });
}
