import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const classSchema = z.object({
  name: z.string().min(2, "Class name is required (e.g. Creche, KG 1, Basic 1, JHS 1)"),
  department: z.enum(["CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"]),
  capacity: z.coerce.number().int().min(5).max(100).default(30),
  teacherId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");

  const where: Record<string, unknown> = {};
  if (user.role === "TEACHER") where.teacherId = user.id;
  if (department && department !== "ALL") where.department = department;

  const [classes, teachers] = await Promise.all([
    prisma.classroom.findMany({
      where,
      orderBy: [{ department: "asc" }, { name: "asc" }],
      include: {
        teacher: { select: { id: true, fullName: true, email: true, phone: true } },
        _count: { select: { students: true } },
      },
    }),
    user.role === "SUPER_ADMIN"
      ? prisma.user.findMany({
          where: { role: "TEACHER", isActive: true },
          select: { id: true, fullName: true, email: true, staffId: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({ classes, teachers });
}

export async function POST(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = classSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid class data" },
        { status: 400 }
      );
    }

    const exists = await prisma.classroom.findUnique({
      where: { name: parsed.data.name.trim() },
    });
    if (exists) {
      return NextResponse.json(
        { error: "A class with this name already exists." },
        { status: 409 }
      );
    }

    const created = await prisma.classroom.create({
      data: {
        name: parsed.data.name.trim(),
        department: parsed.data.department,
        capacity: parsed.data.capacity,
        teacherId: parsed.data.teacherId || null,
      },
      include: {
        teacher: { select: { id: true, fullName: true, email: true, phone: true } },
        _count: { select: { students: true } },
      },
    });

    return NextResponse.json({ classroom: created }, { status: 201 });
  } catch (err) {
    console.error("Create class error:", err);
    return NextResponse.json(
      { error: "Failed to create classroom." },
      { status: 500 }
    );
  }
}
