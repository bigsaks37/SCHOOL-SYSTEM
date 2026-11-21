import crypto from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { neonAuth, isNeonAuthConfigured } from "@/lib/neonAuth";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { ensureInitialAdminSeeded, formatDatabaseError } from "@/lib/bootstrap";
import type { UserRole } from "@/lib/rbac";

/**
 * Bridges an active Neon Managed Better Auth session into the Sankofa SMS
 * 4-role RBAC session cookie (sms_session).
 * - Matches an existing school account by email (preserving Headmaster/Bursar/Teacher/Parent role)
 * - Or provisions a new Parent/Guardian account if signing up fresh via Neon Auth
 */
export async function POST() {
  if (!isNeonAuthConfigured()) {
    return NextResponse.json(
      { error: "Neon Auth is not configured on this environment." },
      { status: 503 }
    );
  }

  try {
    const { data: session, error } = await neonAuth.getSession();
    if (error || !session?.user?.email) {
      return NextResponse.json(
        { error: "No active Neon Auth session found. Please sign in first." },
        { status: 401 }
      );
    }

    await ensureInitialAdminSeeded();

    const normalizedEmail = session.user.email.trim().toLowerCase();
    let smsUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!smsUser) {
      const randomPasswordHash = await bcrypt.hash(
        crypto.randomBytes(24).toString("hex"),
        10
      );
      smsUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName:
            session.user.name?.trim() ||
            normalizedEmail.split("@")[0] ||
            "School Member",
          passwordHash: randomPasswordHash,
          role: "PARENT",
          isActive: true,
        },
      });
    }

    if (!smsUser.isActive) {
      return NextResponse.json(
        { error: "This school account has been suspended. Contact the Headmaster." },
        { status: 403 }
      );
    }

    const token = await signSessionToken({
      userId: smsUser.id,
      email: smsUser.email,
      fullName: smsUser.fullName,
      role: smsUser.role as UserRole,
    });

    const response = NextResponse.json({
      user: {
        id: smsUser.id,
        fullName: smsUser.fullName,
        email: smsUser.email,
        phone: smsUser.phone,
        role: smsUser.role,
      },
      neonAuthUser: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    const diag = formatDatabaseError(err);
    console.error("[POST /api/auth/neon-bridge] Bridge failed:", {
      status: diag.status,
      code: diag.code,
      message: diag.message,
      error: err,
    });
    return NextResponse.json(
      { error: diag.message, code: diag.code },
      { status: diag.status }
    );
  }
}
