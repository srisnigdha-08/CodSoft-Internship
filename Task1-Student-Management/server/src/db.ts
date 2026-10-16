import pg from "pg";
import { getDatabaseConfig } from "./env.js";

const { Pool } = pg;

export const pool = new Pool(getDatabaseConfig());

pool.on("error", () => {
  // Do not log driver details: they can include host or account information.
  console.error("Unexpected idle database connection error.");
});
