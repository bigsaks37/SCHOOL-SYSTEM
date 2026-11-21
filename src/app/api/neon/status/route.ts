import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { functionBaseUrl } from "@neon/env";
import { requireRole, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isNeonAuthConfigured, neonAuth } from "@/lib/neonAuth";
import { getAiGatewayStatus } from "@/lib/neonAi";
import {
  getAllowedAnnouncementFilters,
  getRealtime,
  isRealtimeConfigured,
  liveAnnouncementsQuery,
} from "@/lib/realtimeServer";

export async function GET() {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  // 1. Neon Postgres live check
  let postgresStatus: {
    ok: boolean;
    pooled: boolean;
    unpooledConfigured: boolean;
    branch: string | null;
    studentsCount?: number;
    dbTime?: string;
    error?: string;
  };
  try {
    const [clockRows, studentsCount] = await Promise.all([
      prisma.$queryRaw<Array<{ now: string }>>`SELECT NOW()::text AS now`,
      prisma.student.count(),
    ]);
    postgresStatus = {
      ok: true,
      pooled: Boolean(process.env.DATABASE_URL?.includes("-pooler")),
      unpooledConfigured: Boolean(process.env.DATABASE_URL_UNPOOLED),
      branch: process.env.NEON_BRANCH || null,
      studentsCount,
      dbTime: clockRows[0]?.now,
    };
  } catch (err) {
    postgresStatus = {
      ok: false,
      pooled: Boolean(process.env.DATABASE_URL?.includes("-pooler")),
      unpooledConfigured: Boolean(process.env.DATABASE_URL_UNPOOLED),
      branch: process.env.NEON_BRANCH || null,
      error: err instanceof Error ? err.message : "Postgres check failed",
    };
  }

  // 2. Neon Auth check
  let authStatus: {
    configured: boolean;
    hasActiveNeonSession: boolean;
    neonUserEmail: string | null;
    jwksConfigured: boolean;
  };
  try {
    const { data: session } = isNeonAuthConfigured()
      ? await neonAuth.getSession()
      : { data: null };
    authStatus = {
      configured: isNeonAuthConfigured(),
      hasActiveNeonSession: Boolean(session?.user),
      neonUserEmail: session?.user?.email ?? null,
      jwksConfigured: Boolean(process.env.NEON_AUTH_JWKS_URL),
    };
  } catch {
    authStatus = {
      configured: isNeonAuthConfigured(),
      hasActiveNeonSession: false,
      neonUserEmail: null,
      jwksConfigured: Boolean(process.env.NEON_AUTH_JWKS_URL),
    };
  }

  // 3. Neon Functions live check via functionBaseUrl("hello")
  let functionStatus: {
    configured: boolean;
    ok: boolean;
    url: string | null;
    httpStatus: number | null;
    data?: unknown;
    error?: string;
  };
  try {
    const fnUrl = functionBaseUrl("hello");
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const fnRes = await fetch(`${fnUrl}/stats`, {
      headers: sessionToken
        ? { Authorization: `Bearer ${sessionToken}` }
        : undefined,
      cache: "no-store",
    });
    const fnData = await fnRes.json().catch(() => null);
    functionStatus = {
      configured: true,
      ok: fnRes.ok,
      url: fnUrl,
      httpStatus: fnRes.status,
      data: fnData,
    };
  } catch (err) {
    functionStatus = {
      configured: Boolean(
        process.env.NEON_BRANCH_ID && process.env.NEON_FUNCTION_HOST_SUFFIX
      ),
      ok: false,
      url: null,
      httpStatus: null,
      error: err instanceof Error ? err.message : "Function invocation failed",
    };
  }

  // 4. Neon AI Gateway live check (/v1/models)
  const aiGatewayStatus = await getAiGatewayStatus();

  // 5. Neon Realtime seal readiness check
  let realtimeStatus: {
    configured: boolean;
    canSeal: boolean;
    urlConfigured: boolean;
    queryFingerprint?: string;
    expiresAt?: number;
    error?: string;
  };
  try {
    if (isRealtimeConfigured()) {
      const { audiences, departments } =
        await getAllowedAnnouncementFilters(user);
      const sealed = await getRealtime().seal({
        query: liveAnnouncementsQuery(audiences, departments),
      });
      realtimeStatus = {
        configured: true,
        canSeal: true,
        urlConfigured: Boolean(process.env.NEON_REALTIME_URL),
        queryFingerprint: sealed.queryFingerprint,
        expiresAt: sealed.expiresAt,
      };
    } else {
      realtimeStatus = {
        configured: false,
        canSeal: false,
        urlConfigured: false,
      };
    }
  } catch (err) {
    realtimeStatus = {
      configured: isRealtimeConfigured(),
      canSeal: false,
      urlConfigured: Boolean(process.env.NEON_REALTIME_URL),
      error: err instanceof Error ? err.message : "Realtime seal failed",
    };
  }

  return NextResponse.json(
    {
      branch: process.env.NEON_BRANCH || null,
      branchId: process.env.NEON_BRANCH_ID || null,
      services: {
        postgres: postgresStatus,
        auth: authStatus,
        functions: functionStatus,
        aiGateway: aiGatewayStatus,
        realtime: realtimeStatus,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
