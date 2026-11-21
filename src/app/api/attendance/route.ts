import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/smsService";

const saveAttendanceSchema = z.object({
  classroomId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  entries: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      remarks: z.string().max(200).optional().nullable(),
    })
  ),
});

export async function GET(request: Request) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "TEACHER",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "register";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const classroomId = searchParams.get("classroomId");
  const department = searchParams.get("department");
  const days = Number(searchParams.get("days") || "14");

  if (user.role === "PARENT") {
    const wards = await prisma.student.findMany({
      where: { parentId: user.id },
      select: {
        id: true,
        admissionNo: true,
        firstName: true,
        lastName: true,
        classroom: { select: { name: true, department: true } },
      },
    });
    const wardIds = wards.map((w) => w.id);
    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: { in: wardIds } },
      orderBy: { date: "desc" },
      take: 60,
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
        classroom: { select: { name: true, department: true } },
      },
    });
    return NextResponse.json({ wards, records });
  }

  const classrooms = await prisma.classroom.findMany({
    where: user.role === "TEACHER" ? { teacherId: user.id } : undefined,
    orderBy: [{ department: "asc" }, { name: "asc" }],
    select: { id: true, name: true, department: true },
  });

  if (mode === "history") {
    const allowedClassIds = classrooms
      .filter((c) => {
        if (classroomId && classroomId !== "ALL") return c.id === classroomId;
        if (department && department !== "ALL") return c.department === department;
        return true;
      })
      .map((c) => c.id);

    const sinceDate =
      days > 0
        ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
        : undefined;

    const historyRecords = await prisma.attendanceRecord.findMany({
      where: {
        classroomId: { in: allowedClassIds },
        ...(sinceDate ? { date: { gte: sinceDate } } : {}),
      },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: 300,
      include: {
        student: {
          select: { id: true, admissionNo: true, firstName: true, lastName: true },
        },
        classroom: { select: { id: true, name: true, department: true } },
        markedBy: { select: { fullName: true } },
      },
    });

    // Aggregate daily roll-call summary by (date, classroomId)
    const grouped = new Map<
      string,
      {
        date: string;
        classroomId: string;
        classroomName: string;
        department: string;
        present: number;
        late: number;
        absent: number;
        excused: number;
        total: number;
        rate: number;
      }
    >();

    for (const r of historyRecords) {
      const key = `${r.date}::${r.classroomId}`;
      const existing = grouped.get(key) || {
        date: r.date,
        classroomId: r.classroomId,
        classroomName: r.classroom.name,
        department: r.classroom.department,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        total: 0,
        rate: 0,
      };
      existing.total += 1;
      if (r.status === "PRESENT") existing.present += 1;
      else if (r.status === "LATE") existing.late += 1;
      else if (r.status === "ABSENT") existing.absent += 1;
      else if (r.status === "EXCUSED") existing.excused += 1;
      existing.rate = Math.round(
        ((existing.present + existing.late) / existing.total) * 100
      );
      grouped.set(key, existing);
    }

    return NextResponse.json({
      classrooms,
      dailySummaries: Array.from(grouped.values()),
      historyRecords,
    });
  }

  const activeClassId =
    classroomId && classrooms.some((c) => c.id === classroomId)
      ? classroomId
      : classrooms[0]?.id || "";

  if (!activeClassId) {
    return NextResponse.json({
      classrooms: [],
      activeClassId: "",
      activeClass: null,
      date,
      students: [],
      records: [],
    });
  }

  const activeClass = classrooms.find((c) => c.id === activeClassId) || null;

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { classroomId: activeClassId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        admissionNo: true,
        firstName: true,
        lastName: true,
        gender: true,
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { classroomId: activeClassId, date },
    }),
  ]);

  return NextResponse.json({
    classrooms,
    activeClassId,
    activeClass,
    date,
    students,
    records,
  });
}

export async function POST(request: Request) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN", "TEACHER"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = saveAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid attendance payload" },
        { status: 400 }
      );
    }

    if (user.role === "TEACHER") {
      const cls = await prisma.classroom.findUnique({
        where: { id: parsed.data.classroomId },
      });
      if (!cls || cls.teacherId !== user.id) {
        return NextResponse.json(
          { error: "You can only mark attendance for your assigned classes." },
          { status: 403 }
        );
      }
    }

    await prisma.$transaction(
      parsed.data.entries.map((entry) =>
        prisma.attendanceRecord.upsert({
          where: {
            studentId_date: {
              studentId: entry.studentId,
              date: parsed.data.date,
            },
          },
          update: {
            status: entry.status,
            remarks: entry.remarks?.trim() || null,
            classroomId: parsed.data.classroomId,
            markedById: user.id,
          },
          create: {
            studentId: entry.studentId,
            classroomId: parsed.data.classroomId,
            date: parsed.data.date,
            status: entry.status,
            remarks: entry.remarks?.trim() || null,
            markedById: user.id,
          },
        })
      )
    );

    // Auto-trigger Absence Alert SMS for any student marked ABSENT
    const absentIds = parsed.data.entries
      .filter((e) => e.status === "ABSENT")
      .map((e) => e.studentId);

    let smsTriggered = 0;
    if (absentIds.length > 0) {
      const [school, absentStudents] = await Promise.all([
        prisma.schoolProfile.findUnique({ where: { id: "default" } }),
        prisma.student.findMany({
          where: { id: { in: absentIds } },
          include: {
            classroom: { select: { name: true } },
            parent: { select: { fullName: true, phone: true } },
          },
        }),
      ]);
      const schoolName = school?.schoolName || "Sankofa Preparatory & JHS";

      for (const st of absentStudents) {
        const phone = st.guardianPhone || st.parent?.phone;
        if (!phone) continue;
        await sendSms({
          recipientPhone: phone,
          recipientName:
            st.guardianName || st.parent?.fullName || `Parent of ${st.firstName}`,
          message: `${schoolName} Attendance Alert: ${st.firstName} ${st.lastName} (${st.classroom?.name || "Class"}) was marked ABSENT on ${parsed.data.date}. Please contact the school office if unaware.`,
          eventType: "ABSENCE_ALERT",
          sentById: user.id,
        });
        smsTriggered += 1;
      }
    }

    return NextResponse.json({
      success: true,
      count: parsed.data.entries.length,
      smsTriggered,
    });
  } catch (err) {
    console.error("Save attendance error:", err);
    return NextResponse.json(
      { error: "Failed to save attendance records." },
      { status: 500 }
    );
  }
}
