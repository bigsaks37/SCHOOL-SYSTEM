/**
 * Next.js Server Startup Hook (runs once when the Node.js server boots).
 * Automatically syncs missing PostgreSQL tables and seeds the default
 * Headmaster login + sample Ghanaian school data on a fresh cloud database.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) {
    console.warn(
      "[startup] DATABASE_URL is not set; skipping startup DB auto-initialization."
    );
    return;
  }

  try {
    const { ensureInitialAdminSeeded } = await import("./lib/bootstrap");
    await ensureInitialAdminSeeded();
  } catch (err) {
    console.error(
      "[startup] Automatic database initialization encountered an error (will retry on first login):",
      err
    );
  }
}
