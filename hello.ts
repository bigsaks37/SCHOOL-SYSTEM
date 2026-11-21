import { attachDatabasePool } from "@neon/functions";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
attachDatabasePool(pool);

const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;
const neonAuthIssuer = authBaseUrl ? new URL(authBaseUrl).origin : undefined;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Cache-Control": "no-store",
  };
}

interface VerifiedCaller {
  sub: string;
  via: "neon-auth-jwks" | "sms-session-jwt";
  role?: string;
}

async function verifyBearerToken(
  request: Request
): Promise<VerifiedCaller | null> {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  // 1. Try Neon Managed Auth JWKS verification
  if (jwks && neonAuthIssuer) {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: neonAuthIssuer,
      });
      if (typeof payload.sub === "string" && payload.sub) {
        return { sub: payload.sub, via: "neon-auth-jwks" };
      }
    } catch {
      // Fall through to app HS256 session JWT verification
    }
  }

  // 2. Try Sankofa SMS HS256 session JWT verification (server-to-function)
  const appSecret = process.env.AUTH_SECRET;
  if (appSecret) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(appSecret)
      );
      if (typeof payload.userId === "string" && payload.userId) {
        return {
          sub: payload.userId,
          via: "sms-session-jwt",
          role: typeof payload.role === "string" ? payload.role : undefined,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const headers = corsHeaders(request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    // Lightweight liveness probe
    if (url.pathname === "/health") {
      return Response.json(
        {
          ok: true,
          service: "neon-functions",
          slug: "hello",
          branch: process.env.NEON_BRANCH || "unknown",
          branchId: process.env.NEON_BRANCH_ID || "unknown",
          timestamp: new Date().toISOString(),
        },
        { headers }
      );
    }

    // Authenticated live school pulse directly adjacent to Neon Postgres
    const caller = await verifyBearerToken(request);
    if (!caller) {
      return Response.json(
        { error: "Unauthorized. Provide a valid Bearer JWT." },
        { status: 401, headers }
      );
    }

    try {
      const [
        dbClock,
        studentsRes,
        teachersRes,
        classesRes,
        announcementsRes,
        paymentsRes,
        termRes,
      ] = await Promise.all([
        pool.query<{ now: string }>("SELECT NOW()::text AS now"),
        pool.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM "Student" WHERE "status" = $1',
          ["ACTIVE"]
        ),
        pool.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM "User" WHERE "role" = $1 AND "isActive" = true',
          ["TEACHER"]
        ),
        pool.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM "Classroom"'
        ),
        pool.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM "Announcement"'
        ),
        pool.query<{ count: string; total: string }>(
          'SELECT COUNT(*)::text AS count, COALESCE(SUM("amountPaid"), 0)::text AS total FROM "FeePayment"'
        ),
        pool.query<{ academicYear: string; termName: string }>(
          'SELECT "academicYear", "termName" FROM "AcademicTerm" WHERE "isCurrent" = true LIMIT 1'
        ),
      ]);

      return Response.json(
        {
          ok: true,
          service: "neon-functions",
          slug: "hello",
          branch: process.env.NEON_BRANCH || "unknown",
          branchId: process.env.NEON_BRANCH_ID || "unknown",
          authenticatedVia: caller.via,
          dbTime: dbClock.rows[0]?.now ?? null,
          activeTerm: termRes.rows[0]
            ? `${termRes.rows[0].academicYear} ${termRes.rows[0].termName}`
            : null,
          metrics: {
            activeStudents: Number(studentsRes.rows[0]?.count ?? 0),
            activeTeachers: Number(teachersRes.rows[0]?.count ?? 0),
            classrooms: Number(classesRes.rows[0]?.count ?? 0),
            announcements: Number(announcementsRes.rows[0]?.count ?? 0),
            feePaymentsCount: Number(paymentsRes.rows[0]?.count ?? 0),
            feePaymentsTotalGhs: Number(paymentsRes.rows[0]?.total ?? 0),
          },
        },
        { headers }
      );
    } catch (err) {
      console.error("[hello function] query error:", err);
      return Response.json(
        { error: "Failed to compute school pulse from Neon Postgres." },
        { status: 500, headers }
      );
    }
  },
};
