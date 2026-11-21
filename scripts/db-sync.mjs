import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Production Build Database Sync Helper.
 * 1. Always runs `prisma generate`.
 * 2. When DATABASE_URL is available, runs `prisma db push --skip-generate --accept-data-loss`
 *    (automatically falling back DATABASE_URL_UNPOOLED -> DATABASE_URL when a host only
 *    provides DATABASE_URL, and retrying once for Neon scale-to-zero cold starts).
 */
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadDotEnv(path.resolve(process.cwd(), ".env"));
loadDotEnv(path.resolve(process.cwd(), ".env.local"));

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const env = { ...process.env };

if (env.DATABASE_URL && !env.DATABASE_URL_UNPOOLED) {
  env.DATABASE_URL_UNPOOLED = env.DATABASE_URL;
  console.log(
    "[db-sync] DATABASE_URL_UNPOOLED not set; defaulting to DATABASE_URL for schema sync."
  );
}

console.log("[db-sync] Generating Prisma Client...");
execSync(`${npxCmd} prisma generate`, { stdio: "inherit", env });

if (!env.DATABASE_URL) {
  console.warn(
    "[db-sync] DATABASE_URL is not set during build; skipping `prisma db push` (runtime auto-bootstrap will sync tables on first startup/login)."
  );
  process.exit(0);
}

function pushSchema() {
  execSync(`${npxCmd} prisma db push --skip-generate --accept-data-loss`, {
    stdio: "inherit",
    env,
  });
}

console.log("[db-sync] Syncing PostgreSQL schema (`prisma db push`)...");
try {
  pushSchema();
} catch (firstErr) {
  console.warn(
    "[db-sync] First `prisma db push` attempt failed (database may be waking from scale-to-zero). Retrying in 3s..."
  );
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  try {
    pushSchema();
  } catch (secondErr) {
    console.error("[db-sync] Schema sync failed:", secondErr);
    process.exit(1);
  }
}
