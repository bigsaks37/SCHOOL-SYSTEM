import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import { normalizeGhanaPhone } from "@/lib/smsService";
import { ensureInitialAdminSeeded } from "@/lib/bootstrap";
import type { UserRole } from "@/lib/rbac";

const loginSchema = z.object({
  // Supports email OR phone number (backward compatible with `email` field)
  identifier: z.string().min(3).optional(),
  email: z.string().min(3).optional(),
  password: z.string().min(1, "Password is required."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.errors[0]?.message ||
            "Please enter your email or registered phone number.",
        },
        { status: 400 }
      );
    }

    const rawIdentifier = (
      parsed.data.identifier ||
      parsed.data.email ||
      ""
    ).trim();

    if (!rawIdentifier) {
      return NextResponse.json(
        { error: "Email or registered phone number is required." },
        { status: 400 }
      );
    }

    // Automatically seed default Headmaster login if the live database is empty
    await ensureInitialAdminSeeded();

    let user = null;
    if (rawIdentifier.includes("@")) {
      user = await prisma.user.findUnique({
        where: { email: rawIdentifier.toLowerCase() },
      });
    } else {
      // Match by normalized Ghana phone number (+233... or 0...)
      const targetPhone = normalizeGhanaPhone(rawIdentifier);
      if (targetPhone.length >= 9) {
        const candidates = await prisma.user.findMany({
          where: { phone: { not: null } },
        });
        user =
          candidates.find(
            (u) => u.phone && normalizeGhanaPhone(u.phone) === targetPhone
          ) || null;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email/phone or password." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This account has been suspended. Contact the Headmaster." },
        { status: 403 }
      );
    }

    const validPassword = await bcrypt.compare(
      parsed.data.password,
      user.passwordHash
    );
    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid email/phone or password." },
        { status: 401 }
      );
    }

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
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
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Unable to process login right now." },
      { status: 500 }
    );
  }
}
