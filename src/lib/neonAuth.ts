import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";

const fallbackBaseUrl = "https://placeholder.neonauth.local/neondb/auth";

export function isNeonAuthConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL);
}

const cookieSecret =
  process.env.NEON_AUTH_COOKIE_SECRET ||
  process.env.AUTH_SECRET ||
  "sankofa-neon-auth-cookie-secret-minimum-32-chars";

export const neonAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || fallbackBaseUrl,
  cookies: {
    secret:
      cookieSecret.length >= 32
        ? cookieSecret
        : cookieSecret.padEnd(32, "0"),
  },
});
