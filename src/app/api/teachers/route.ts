import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createTeacherSchema = z.object({
  staffId: z.string().optional(),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(5, "Phone number is required").max(30),
  qualification: z.string().max(120).optional().nullable(),
  subjects: z.array(z.string()).default([]),
  classroomIds: z.array(z.string()).default([]),
  password: z.string().min(6, "Initial password must be at least 6 characters"),
});

export async function GET(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const department = searchParams.get("department");

  const where: Record<string, unknown> = { role: "TEACHER" };
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { staffId: { contains: search, mode: "insensitive" } },
      { subjects: { contains: search, mode: "insensitive" } },
    ];
  }
  if (department && department !== "ALL") {
    where.assignedClasses = { some: { department } };
  }

  const [teachers, classrooms] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        staffId: true,
        fullName: true,
        email: true,
        phone: true,
        qualification: true,
        subjects: true,
        isActive: true,
        createdAt: true,
        assignedClasses: {
          select: { id: true, name: true, department: true },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.classroom.findMany({
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        department: true,
        teacherId: true,
        teacher: { select: { fullName: true } },
      },
    }),
  ]);

  return NextResponse.json({ teachers, classrooms });
}

export async function POST(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = createTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid teacher details" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    let staffId = parsed.data.staffId?.trim();
    if (!staffId) {
      const year = new Date().getFullYear();
      const count = await prisma.user.count({ where: { role: "TEACHER" } });
      let seq = count + 1;
      staffId = `STF-${year}-${String(seq).padStart(3, "0")}`;
      while (await prisma.user.findUnique({ where: { staffId } })) {
        seq += 1;
        staffId = `STF-${year}-${String(seq).padStart(3, "0")}`;
      }
    } else {
      const dupStaff = await prisma.user.findUnique({ where: { staffId } });
      if (dupStaff) {
        return NextResponse.json(
          { error: "Staff ID already exists." },
          { status: 409 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const subjectsStr = parsed.data.subjects
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");

    const created = await prisma.$transaction(async (tx) => {
      const teacher = await tx.user.create({
        data: {
          staffId,
          fullName: parsed.data.fullName.trim(),
          email,
          phone: parsed.data.phone.trim(),
          qualification: parsed.data.qualification?.trim() || null,
          subjects: subjectsStr || null,
          passwordHash,
          role: "TEACHER",
          isActive: true,
        },
      });

      if (parsed.data.classroomIds.length > 0) {
        await tx.classroom.updateMany({
          where: { id: { in: parsed.data.classroomIds } },
          data: { teacherId: teacher.id },
        });
      }

      return tx.user.findUnique({
        where: { id: teacher.id },
        select: {
          id: true,
          staffId: true,
          fullName: true,
          email: true,
          phone: true,
          qualification: true,
          subjects: true,
          isActive: true,
          assignedClasses: { select: { id: true, name: true, department: true } },
        },
      });
    });

    return NextResponse.json({ teacher: created }, { status: 201 });
  } catch (err) {
    console.error("Create teacher error:", err);
    return NextResponse.json(
      { error: "Failed to register teacher." },
      { status: 500 }
    );
  }
}
