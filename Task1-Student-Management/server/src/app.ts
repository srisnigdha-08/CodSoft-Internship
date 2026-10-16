import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import type { Pool } from "pg";
import { ApiError } from "./errors.js";
import { academicsRouter } from "./routes/academics.js";
import { attendanceRouter } from "./routes/attendance.js";
import { authRouter } from "./routes/auth.js";
import { classesRouter } from "./routes/classes.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { feesRouter } from "./routes/fees.js";
import { studentsRouter } from "./routes/students.js";
import { teachersRouter } from "./routes/teachers.js";

interface AppOptions {
  pool: Pool;
  jwtSecret: string;
  frontendOrigin: string;
  secureCookie: boolean;
}

export function createApp(options: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: options.frontendOrigin, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
  app.use(express.json({ limit: "1mb" }));

  app.use((req, _res, next) => {
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const origin = req.get("origin");
    if (unsafe && origin && origin !== options.frontendOrigin) {
      next(new ApiError(403, "Requests from this website are not allowed.", "ORIGIN_REJECTED"));
      return;
    }
    next();
  });

  app.get("/api/health", async (_req, res) => {
    try {
      await options.pool.query("SELECT 1");
      res.json({ data: { status: "ok", database: "connected" } });
    } catch {
      res.status(503).json({ error: { code: "DATABASE_UNAVAILABLE", message: "The database is unavailable. Check the server configuration and database service." } });
    }
  });

  app.use("/api/auth", authRouter({ pool: options.pool, secret: options.jwtSecret, secureCookie: options.secureCookie }));
  app.use("/api/dashboard", dashboardRouter(options.pool, options.jwtSecret));
  app.use("/api/students", studentsRouter(options.pool, options.jwtSecret));
  app.use("/api/teachers", teachersRouter(options.pool, options.jwtSecret));
  app.use("/api/classes", classesRouter(options.pool, options.jwtSecret));
  app.use("/api/attendance", attendanceRouter(options.pool, options.jwtSecret));
  app.use("/api/academics", academicsRouter(options.pool, options.jwtSecret));
  app.use("/api/fees", feesRouter(options.pool, options.jwtSecret));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "API endpoint was not found." } });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    void next;
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const databaseCode = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (databaseCode === "23505") {
      res.status(409).json({ error: { code: "DUPLICATE_RECORD", message: "A record with those details already exists." } });
      return;
    }
    if (databaseCode === "23503" || databaseCode === "23514") {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request refers to an invalid or unavailable record." } });
      return;
    }
    if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed") {
      res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." } });
      return;
    }
    if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
      res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large." } });
      return;
    }
    // The error details are intentionally omitted from responses and logs.
    console.error("Unhandled API request error.");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
  };
  app.use(errorHandler);
  return app;
}
