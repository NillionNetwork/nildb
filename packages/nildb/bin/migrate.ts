import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { mongoMigrateCli } from "mongo-migrate-ts";

dotenv.config();

console.warn("! Database migration check");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "../migrations");

mongoMigrateCli({
  uri: process.env.APP_DB_URI,
  database: process.env.APP_DB_NAME_PRIMARY,
  migrationsDir,
  globPattern: "[0-9]*_[0-9]*_[a-z]*.ts",
  migrationNameTimestampFormat: "yyyyMMdd_HHmm",
});
