import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeRankMap, calculateJhsBeceAggregate } from "@/lib/grading";
import { sendSms } from "@/lib/smsService";

const bulkPublishSchema = z.object({
  classroomId: z.string().min(1),
  termId: z.string().min(1),
  headmasterRemarks: z.string().max(300).optional(),
});

export async function GET(request: Request) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "TEACHER",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const requestedTermId = searchParams.get("termId");
  const department = searchParams.get("department");
  const classroomId = searchParams.get("classroomId");

  const terms = await prisma.academicTerm.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });
  const activeTerm =
    terms.find((t) => t.id === requestedTermId) ||
    terms.find((t) => t.isCurrent) ||
    terms[0];

  if (!activeTerm) {
    return NextResponse.json({
      role: user.role,
      terms: [],
      activeTerm: null,
      classrooms: [],
      rows: [],
    });
  }

  let classrooms: Array<{ id: string; name: string; department: string }> = [];
  let studentWhere: Record<string, unknown> = { status: "ACTIVE" };

  if (user.role === "PARENT") {
    studentWhere = { parentId: user.id, status: "ACTIVE" };
  } else if (user.role === "TEACHER") {
    classrooms = await prisma.classroom.findMany({
      where: {
        teacherId: user.id,
        department: { in: ["KINDERGARTEN", "PRIMARY", "JHS"] },
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select: { id: true, name: true, department: true },
    });
    const ids = classrooms.map((c) => c.id);
    studentWhere = {
      status: "ACTIVE",
      classroomId:
        classroomId && classroomId !== "ALL" && ids.includes(classroomId)
          ? classroomId
          : { in: ids },
    };
  } else {
    classrooms = await prisma.classroom.findMany({
      where: { department: { in: ["KINDERGARTEN", "PRIMARY", "JHS"] } },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select: { id: true, name: true, department: true },
    });
    if (classroomId && classroomId !== "ALL") {
      studentWhere.classroomId = classroomId;
    } else if (department && department !== "ALL") {
      studentWhere.classroom = { department };
    } else {
      studentWhere.classroom = {
        department: { in: ["KINDERGARTEN", "PRIMARY", "JHS"] },
      };
    }
  }

  const students = await prisma.student.findMany({
    where: studentWhere,
    orderBy: [{ classroom: { name: "asc" } }, { lastName: "asc" }],
    include: {
      classroom: { select: { id: true, name: true, department: true } },
      assessments: { where: { termId: activeTerm.id } },
      reportCards: {
        where: { termId: activeTerm.id },
        include: { approvedBy: { select: { fullName: true } } },
      },
    },
  });

  // Group by classroom to compute per-class overall position
  const byClass = new Map<string, typeof students>();
  for (const s of students) {
    if (!s.classroomId) continue;
    const list = byClass.get(s.classroomId) || [];
    list.push(s);
    byClass.set(s.classroomId, list);
  }

  const rankByStudent = new Map<string, { rank: number | null; size: number }>();
  for (const [, clsStudents] of byClass.entries()) {
    const scored = clsStudents
      .filter((s) => s.assessments.length > 0 && s.classroom?.department !== "KINDERGARTEN")
      .map((s) => ({
        id: s.id,
        score:
          s.assessments.reduce((sum, a) => sum + a.totalScore, 0) /
          s.assessments.length,
      }));
    const ranks = computeRankMap(scored);
    for (const s of clsStudents) {
      rankByStudent.set(s.id, {
        rank: ranks.get(s.id) ?? null,
        size: clsStudents.length,
      });
    }
  }

  const rows = students.map((s) => {
    const dept = s.classroom?.department || "PRIMARY";
    const rc = s.reportCards[0] || null;
    const avgScore =
      dept !== "KINDERGARTEN" && s.assessments.length > 0
        ? Number(
          (
            s.assessments.reduce((sum, a) => sum + a.totalScore, 0) /
            s.assessments.length
          ).toFixed(1)
        )
        : null;
    const pos = rankByStudent.get(s.id) || { rank: null, size: 1 };
    const jhsAgg =
      dept === "JHS" ? calculateJhsBeceAggregate(s.assessments) : null;

    return {
      studentId: s.id,
      admissionNo: s.admissionNo,
      fullName: `${s.firstName} ${s.lastName}`,
      classroomId: s.classroomId,
      classroomName: s.classroom?.name || "Unassigned",
      department: dept,
      subjectsCount: s.assessments.length,
      averageScore: avgScore,
      overallPosition: pos.rank,
      classSize: pos.size,
      jhsAggregate: jhsAgg?.aggregate ?? null,
      jhsAggregateComplete: jhsAgg?.isComplete ?? false,
      status: rc?.status || "DRAFT",
      approvedBy: rc?.approvedBy?.fullName || null,
      approvedAt: rc?.approvedAt || null,
    };
  });

  return NextResponse.json({
    role: user.role,
    terms,
    activeTerm,
    classrooms,
    rows,
  });
}

// Headmaster Bulk Approve & Publish for an entire class
export async function POST(request: Request) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = bulkPublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid bulk publish input" },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: { classroomId: parsed.data.classroomId, status: "ACTIVE" },
      include: {
        classroom: { select: { name: true } },
        parent: { select: { fullName: true, phone: true } },
      },
    });

    const now = new Date();
    await prisma.$transaction(
      students.map((s) =>
        prisma.termReportCard.upsert({
          where: {
            studentId_termId: { studentId: s.id, termId: parsed.data.termId },
          },
          update: {
            status: "PUBLISHED",
            approvedById: user.id,
            approvedAt: now,
            publishedAt: now,
            ...(parsed.data.headmasterRemarks
              ? { headmasterRemarks: parsed.data.headmasterRemarks.trim() }
              : {}),
          },
          create: {
            studentId: s.id,
            termId: parsed.data.termId,
            status: "PUBLISHED",
            approvedById: user.id,
            approvedAt: now,
            publishedAt: now,
            headmasterRemarks:
              parsed.data.headmasterRemarks?.trim() ||
              "Approved and published by the Headmaster.",
          },
        })
      )
    );

    // Auto-trigger Report Published SMS for every student in the class
    const [school, term] = await Promise.all([
      prisma.schoolProfile.findUnique({ where: { id: "default" } }),
      prisma.academicTerm.findUnique({ where: { id: parsed.data.termId } }),
    ]);
    for (const s of students) {
      const phone = s.guardianPhone || s.parent?.phone;
      if (!phone) continue;
      await sendSms({
        recipientPhone: phone,
        recipientName:
          s.guardianName || s.parent?.fullName || `Parent of ${s.firstName}`,
        message: `${school?.schoolName || "Sankofa Preparatory & JHS"}: ${term?.termName || "Term"} Terminal Report Card for ${s.firstName} ${s.lastName} (${s.classroom?.name || ""}) is now published in your Parent Portal.`,
        eventType: "REPORT_PUBLISHED",
        sentById: user.id,
      });
    }

    return NextResponse.json({ success: true, count: students.length });
  } catch (err) {
    console.error("Bulk publish error:", err);
    return NextResponse.json(
      { error: "Failed to publish class report cards." },
      { status: 500 }
    );
  }
}
