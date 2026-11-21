import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createStudentSchema = z.object({
  admissionNo: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gender: z.enum(["MALE", "FEMALE"]),
  dateOfBirth: z.string().optional().nullable(),
  nhisNumber: z.string().optional().nullable(),
  guardianName: z.string().max(120).optional().nullable(),
  guardianPhone: z.string().max(30).optional().nullable(),
  guardianNote: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "GRADUATED", "TRANSFERRED"]).optional(),
  classroomId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");
  const classroomId = searchParams.get("classroomId");
  const studentStatus = searchParams.get("status");
  const search = searchParams.get("search")?.trim();

  const where: Record<string, unknown> = {};

  if (user.role === "PARENT") {
    where.parentId = user.id;
  } else if (user.role === "TEACHER") {
    const assigned = await prisma.classroom.findMany({
      where: { teacherId: user.id },
      select: { id: true },
    });
    const assignedIds = assigned.map((c) => c.id);
    if (classroomId && classroomId !== "ALL") {
      where.classroomId = classroomId;
    } else if (assignedIds.length > 0) {
      where.classroomId = { in: assignedIds };
    }
  } else {
    if (classroomId && classroomId !== "ALL") {
      where.classroomId = classroomId;
    } else if (department && department !== "ALL") {
      where.classroom = { department };
    }
  }

  if (studentStatus && studentStatus !== "ALL") {
    where.status = studentStatus;
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { admissionNo: { contains: search, mode: "insensitive" } },
      { guardianName: { contains: search, mode: "insensitive" } },
      { guardianPhone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [students, classrooms, parents] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        classroom: {
          select: {
            id: true,
            name: true,
            department: true,
            teacher: { select: { fullName: true } },
          },
        },
        parent: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
    }),
    user.role === "TEACHER"
      ? prisma.classroom.findMany({
        where: { teacherId: user.id },
        select: { id: true, name: true, department: true },
        orderBy: [{ department: "asc" }, { name: "asc" }],
      })
      : prisma.classroom.findMany({
        select: { id: true, name: true, department: true },
        orderBy: [{ department: "asc" }, { name: "asc" }],
      }),
    user.role === "SUPER_ADMIN"
      ? prisma.user.findMany({
        where: { role: "PARENT", isActive: true },
        select: { id: true, fullName: true, email: true, phone: true },
        orderBy: { fullName: "asc" },
      })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({ students, classrooms, parents });
}

export async function POST(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = createStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid student data" },
        { status: 400 }
      );
    }

    let admissionNo = parsed.data.admissionNo?.trim();
    if (!admissionNo) {
      const year = new Date().getFullYear();
      const count = await prisma.student.count();
      let suffix = count + 1;
      admissionNo = `SPS-${year}-${String(suffix).padStart(3, "0")}`;
      while (await prisma.student.findUnique({ where: { admissionNo } })) {
        suffix += 1;
        admissionNo = `SPS-${year}-${String(suffix).padStart(3, "0")}`;
      }
    } else {
      const dup = await prisma.student.findUnique({ where: { admissionNo } });
      if (dup) {
        return NextResponse.json(
          { error: "Student ID already exists." },
          { status: 409 }
        );
      }
    }

    // If linked to an existing Parent user and guardian fields are blank, hydrate them automatically
    let guardianName = parsed.data.guardianName?.trim() || null;
    let guardianPhone = parsed.data.guardianPhone?.trim() || null;
    if (parsed.data.parentId && (!guardianName || !guardianPhone)) {
      const parentRec = await prisma.user.findUnique({
        where: { id: parsed.data.parentId },
        select: { fullName: true, phone: true },
      });
      if (parentRec) {
        guardianName = guardianName || parentRec.fullName;
        guardianPhone = guardianPhone || parentRec.phone;
      }
    }

    const created = await prisma.student.create({
      data: {
        admissionNo,
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        gender: parsed.data.gender,
        dateOfBirth: parsed.data.dateOfBirth || null,
        nhisNumber: parsed.data.nhisNumber?.trim() || null,
        guardianName,
        guardianPhone,
        guardianNote: parsed.data.guardianNote?.trim() || null,
        status: parsed.data.status || "ACTIVE",
        classroomId: parsed.data.classroomId || null,
        parentId: parsed.data.parentId || null,
      },
      include: {
        classroom: { select: { id: true, name: true, department: true } },
        parent: { select: { id: true, fullName: true, phone: true } },
      },
    });

    return NextResponse.json({ student: created }, { status: 201 });
  } catch (err) {
    console.error("Create student error:", err);
    return NextResponse.json(
      { error: "Failed to register student." },
      { status: 500 }
    );
  }
}
