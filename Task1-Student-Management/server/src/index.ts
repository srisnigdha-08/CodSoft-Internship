import { createApp } from "./app.js";
import { formatDatabaseFailure } from "./databaseGuards.js";
import { connectDatabase, disconnectDatabase } from "./db.js";
import { getMongoConfig, getServerConfig } from "./env.js";

const config = getServerConfig();
const mongo = getMongoConfig();

try {
  await connectDatabase(mongo.uri);
} catch (error) {
  console.error(formatDatabaseFailure(error, "API startup"));
  process.exit(1);
}

const app = createApp({
  jwtSecret: config.jwtSecret,
  frontendOrigin: config.frontendOrigin,
  secureCookie: config.secureCookie,
});

const server = app.listen(config.port, () => console.log(`Student Management API listening on port ${config.port}.`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  });
}
