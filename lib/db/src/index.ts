import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

// Don't throw — the API server's dbManager handles dynamic connections.
// Routes use getDb() instead of this static export.
export const pool = connectionString ? new Pool({ connectionString }) : null;
export const db = pool ? drizzle(pool, { schema }) : null;

export * from "./schema";
