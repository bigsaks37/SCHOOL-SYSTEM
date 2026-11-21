import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(["SUPER_ADMIN", "BURSAR", "TEACHER", "PARENT"]),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search")?.trim();

  const where: Record<string, unknown> = {};
  if (role && role !== "ALL") where.role = role;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          assignedClasses: true,
          wards: true,
        },
      },
    },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const created = await prisma.user.create({
      data: {
        fullName: parsed.data.fullName.trim(),
        email,
        phone: parsed.data.phone?.trim() || null,
        role: parsed.data.role,
        passwordHash,
        isActive: parsed.data.isActive ?? true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json(
      { error: "Failed to create user." },
      { status: 500 }
    );
  }
}
