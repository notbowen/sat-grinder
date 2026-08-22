import "dotenv/config";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "../src/lib/db";

migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
sqlite.pragma("optimize");
console.log("Database migrations are up to date.");
