import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const careLogSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  classroomId: z.string().min(1, "Creche classroom is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  breakfastStatus: z
    .enum(["ATE_ALL", "ATE_HALF", "REFUSED", "NOT_APPLICABLE"])
    .default("ATE_ALL"),
  lunchStatus: z
    .enum(["ATE_ALL", "ATE_HALF", "REFUSED", "NOT_APPLICABLE"])
    .default("ATE_ALL"),
  feedingNotes: z.string().max(300).optional().nullable(),
  napDuration: z.string().max(80).optional().nullable(),
  sleepQuality: z
    .enum(["PEACEFUL", "LIGHT", "RESTLESS", "NO_NAP"])
    .default("PEACEFUL"),
  diaperChecks: z.coerce.number().int().min(0).max(20).default(2),
  pottyNotes: z.string().max(300).optional().nullable(),
  temperature: z.string().max(30).optional().nullable(),
  mood: z
    .enum(["HAPPY", "CALM", "TIRED", "FUSSY", "UNWELL"])
    .default("HAPPY"),
  healthNotes: z.string().max(300).optional().nullable(),
  pickupAuthorizedName: z.string().max(120).optional().nullable(),
  pickupIdType: z.string().max(60).optional().nullable(),
  pickupIdNumber: z.string().max(60).optional().nullable(),
  pickupTime: z.string().max(20).optional().nullable(),
  pickupVerified: z.boolean().default(false),
});

export async function GET(request: Request) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "TEACHER",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "daily";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const classroomId = searchParams.get("classroomId");

  // Parent view: only their wards who are enrolled in the CRECHE department
  if (user.role === "PARENT") {
    const wards = await prisma.student.findMany({
      where: {
        parentId: user.id,
        classroom: { department: "CRECHE" },
      },
      select: {
        id: true,
        admissionNo: true,
        firstName: true,
        lastName: true,
        classroom: { select: { id: true, name: true } },
      },
    });

    const wardIds = wards.map((w) => w.id);
    const logs = await prisma.crecheCareLog.findMany({
      where: { studentId: { in: wardIds } },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: 40,
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            firstName: true,
            lastName: true,
            guardianName: true,
            guardianPhone: true,
          },
        },
        classroom: { select: { id: true, name: true } },
        recordedBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json({ role: user.role, wards, logs });
  }

  // Staff view (SUPER_ADMIN or assigned Creche TEACHER)
  const crecheClasses = await prisma.classroom.findMany({
    where: {
      department: "CRECHE",
      ...(user.role === "TEACHER" ? { teacherId: user.id } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      department: true,
      teacher: { select: { fullName: true } },
      _count: { select: { students: true } },
    },
  });

  if (crecheClasses.length === 0) {
    return NextResponse.json({
      role: user.role,
      classrooms: [],
      activeClassId: "",
      date,
      students: [],
      logs: [],
      historyLogs: [],
    });
  }

  if (mode === "history") {
    const classIds =
      classroomId && classroomId !== "ALL"
        ? crecheClasses.filter((c) => c.id === classroomId).map((c) => c.id)
        : crecheClasses.map((c) => c.id);

    const historyLogs = await prisma.crecheCareLog.findMany({
      where: { classroomId: { in: classIds } },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: 80,
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            firstName: true,
            lastName: true,
            guardianName: true,
            guardianPhone: true,
          },
        },
        classroom: { select: { id: true, name: true } },
        recordedBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json({
      role: user.role,
      classrooms: crecheClasses,
      historyLogs,
    });
  }

  const activeClassId =
    classroomId && crecheClasses.some((c) => c.id === classroomId)
      ? classroomId
      : crecheClasses[0].id;

  const [students, logs] = await Promise.all([
    prisma.student.findMany({
      where: { classroomId: activeClassId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        admissionNo: true,
        firstName: true,
        lastName: true,
        gender: true,
        guardianName: true,
        guardianPhone: true,
        parent: { select: { fullName: true, phone: true } },
      },
    }),
    prisma.crecheCareLog.findMany({
      where: { classroomId: activeClassId, date },
      include: {
        recordedBy: { select: { fullName: true } },
      },
    }),
  ]);

  return NextResponse.json({
    role: user.role,
    classrooms: crecheClasses,
    activeClassId,
    date,
    students,
    logs,
  });
}

export async function POST(request: Request) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN", "TEACHER"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = careLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid care log data" },
        { status: 400 }
      );
    }

    // Exclusively enforce CRECHE department
    const classroom = await prisma.classroom.findUnique({
      where: { id: parsed.data.classroomId },
    });
    if (!classroom || classroom.department !== "CRECHE") {
      return NextResponse.json(
        { error: "Daily Care Reports are exclusive to the Creche / Daycare department." },
        { status: 400 }
      );
    }

    if (user.role === "TEACHER" && classroom.teacherId !== user.id) {
      return NextResponse.json(
        { error: "You can only record Creche care logs for your assigned Creche classes." },
        { status: 403 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: parsed.data.studentId },
      select: { id: true, classroomId: true },
    });
    if (!student || student.classroomId !== classroom.id) {
      return NextResponse.json(
        { error: "Student does not belong to this Creche class." },
        { status: 400 }
      );
    }

    const saved = await prisma.crecheCareLog.upsert({
      where: {
        studentId_date: {
          studentId: parsed.data.studentId,
          date: parsed.data.date,
        },
      },
      update: {
        classroomId: classroom.id,
        breakfastStatus: parsed.data.breakfastStatus,
        lunchStatus: parsed.data.lunchStatus,
        feedingNotes: parsed.data.feedingNotes?.trim() || null,
        napDuration: parsed.data.napDuration?.trim() || null,
        sleepQuality: parsed.data.sleepQuality,
        diaperChecks: parsed.data.diaperChecks,
        pottyNotes: parsed.data.pottyNotes?.trim() || null,
        temperature: parsed.data.temperature?.trim() || null,
        mood: parsed.data.mood,
        healthNotes: parsed.data.healthNotes?.trim() || null,
        pickupAuthorizedName: parsed.data.pickupAuthorizedName?.trim() || null,
        pickupIdType: parsed.data.pickupIdType?.trim() || null,
        pickupIdNumber: parsed.data.pickupIdNumber?.trim() || null,
        pickupTime: parsed.data.pickupTime?.trim() || null,
        pickupVerified: parsed.data.pickupVerified,
        recordedById: user.id,
      },
      create: {
        studentId: parsed.data.studentId,
        classroomId: classroom.id,
        date: parsed.data.date,
        breakfastStatus: parsed.data.breakfastStatus,
        lunchStatus: parsed.data.lunchStatus,
        feedingNotes: parsed.data.feedingNotes?.trim() || null,
        napDuration: parsed.data.napDuration?.trim() || null,
        sleepQuality: parsed.data.sleepQuality,
        diaperChecks: parsed.data.diaperChecks,
        pottyNotes: parsed.data.pottyNotes?.trim() || null,
        temperature: parsed.data.temperature?.trim() || null,
        mood: parsed.data.mood,
        healthNotes: parsed.data.healthNotes?.trim() || null,
        pickupAuthorizedName: parsed.data.pickupAuthorizedName?.trim() || null,
        pickupIdType: parsed.data.pickupIdType?.trim() || null,
        pickupIdNumber: parsed.data.pickupIdNumber?.trim() || null,
        pickupTime: parsed.data.pickupTime?.trim() || null,
        pickupVerified: parsed.data.pickupVerified,
        recordedById: user.id,
      },
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
        classroom: { select: { name: true } },
        recordedBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json({ careLog: saved }, { status: 201 });
  } catch (err) {
    console.error("Save creche care log error:", err);
    return NextResponse.json(
      { error: "Failed to save Creche Daily Care Report." },
      { status: 500 }
    );
  }
}
