import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeRankMap,
  calculateJhsBeceAggregate,
  formatOrdinal,
} from "@/lib/grading";
import { sendSms } from "@/lib/smsService";

const updateReportSchema = z.object({
  termId: z.string().min(1),
  teacherRemarks: z.string().max(400).optional().nullable(),
  conduct: z.string().max(120).optional().nullable(),
  interest: z.string().max(160).optional().nullable(),
  headmasterRemarks: z.string().max(400).optional().nullable(),
  action: z.enum(["SAVE_DRAFT", "SUBMIT_APPROVAL", "PUBLISH", "UNPUBLISH"]).optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "TEACHER",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { studentId } = await context.params;
  const { searchParams } = new URL(request.url);
  const requestedTermId = searchParams.get("termId");

  const [school, terms, student] = await Promise.all([
    prisma.schoolProfile.findUnique({ where: { id: "default" } }),
    prisma.academicTerm.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
    prisma.student.findUnique({
      where: { id: studentId },
      include: {
        classroom: {
          include: { teacher: { select: { id: true, fullName: true } } },
        },
        parent: { select: { id: true, fullName: true, phone: true } },
      },
    }),
  ]);

  if (!student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  // Enforce RBAC ownership
  if (user.role === "PARENT" && student.parentId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (
    user.role === "TEACHER" &&
    student.classroom?.teacherId !== user.id
  ) {
    return NextResponse.json(
      { error: "You can only view report cards for your assigned classes." },
      { status: 403 }
    );
  }

  const activeTerm =
    terms.find((t) => t.id === requestedTermId) ||
    terms.find((t) => t.isCurrent) ||
    terms[0];

  if (!activeTerm) {
    return NextResponse.json(
      { error: "No academic term configured." },
      { status: 400 }
    );
  }

  const reportCard = await prisma.termReportCard.findUnique({
    where: { studentId_termId: { studentId: student.id, termId: activeTerm.id } },
    include: { approvedBy: { select: { fullName: true } } },
  });

  // Headmaster Approval is REQUIRED before Parents can view a published report card
  if (user.role === "PARENT" && reportCard?.status !== "PUBLISHED") {
    return NextResponse.json({
      role: user.role,
      published: false,
      status: reportCard?.status || "DRAFT",
      student: {
        id: student.id,
        admissionNo: student.admissionNo,
        fullName: `${student.firstName} ${student.lastName}`,
        classroomName: student.classroom?.name || "Unassigned",
        department: student.classroom?.department || "PRIMARY",
      },
      term: activeTerm,
      terms,
      message:
        "This Terminal Report Card is currently awaiting Headmaster Approval before publication.",
    });
  }

  // Load classmate assessments to calculate Subject Position & Overall Class Position
  const classroomId = student.classroomId;
  const [classStudents, classAssessments, termAttendance, allStudentAttendance] =
    await Promise.all([
      classroomId
        ? prisma.student.findMany({
            where: { classroomId, status: "ACTIVE" },
            select: { id: true },
          })
        : Promise.resolve([{ id: student.id }]),
      classroomId
        ? prisma.assessment.findMany({
            where: {
              termId: activeTerm.id,
              student: { classroomId, status: "ACTIVE" },
            },
          })
        : prisma.assessment.findMany({
            where: { termId: activeTerm.id, studentId: student.id },
          }),
      prisma.attendanceRecord.findMany({
        where: {
          studentId: student.id,
          date: { gte: activeTerm.startDate, lte: activeTerm.endDate },
        },
      }),
      prisma.attendanceRecord.findMany({
        where: { studentId: student.id },
      }),
    ]);

  const attSource =
    termAttendance.length > 0 ? termAttendance : allStudentAttendance;
  const presentDays = attSource.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;
  const totalDays = attSource.length;

  const department = student.classroom?.department || "PRIMARY";
  const myAssessments = classAssessments
    .filter((a) => a.studentId === student.id)
    .sort((a, b) => {
      if (a.subjectCategory !== b.subjectCategory) {
        return a.subjectCategory === "CORE" ? -1 : 1;
      }
      return a.subject.localeCompare(b.subject);
    });

  // Compute subject-by-subject position across classmates
  const subjects = myAssessments.map((a) => {
    let subjectRank: number | null = null;
    if (department !== "KINDERGARTEN") {
      const peersForSubject = classAssessments
        .filter((ca) => ca.subject === a.subject)
        .map((ca) => ({ id: ca.studentId, score: ca.totalScore }));
      const rankMap = computeRankMap(peersForSubject);
      subjectRank = rankMap.get(student.id) ?? null;
    }

    return {
      id: a.id,
      subject: a.subject,
      subjectCategory: a.subjectCategory,
      classScore: a.classScore,
      examScore: a.examScore,
      totalScore: a.totalScore,
      grade: a.grade,
      masteryRating: a.masteryRating,
      remarks: a.remarks,
      position: subjectRank,
      positionLabel: formatOrdinal(subjectRank),
    };
  });

  // Compute overall class position
  let overallPosition: number | null = null;
  let averageScore: number | null = null;
  if (department !== "KINDERGARTEN") {
    const classAvgs = classStudents
      .map((cs) => {
        const list = classAssessments.filter((ca) => ca.studentId === cs.id);
        if (list.length === 0) return null;
        return {
          id: cs.id,
          score: list.reduce((sum, x) => sum + x.totalScore, 0) / list.length,
        };
      })
      .filter((x): x is { id: string; score: number } => x !== null);

    const overallRanks = computeRankMap(classAvgs);
    overallPosition = overallRanks.get(student.id) ?? null;
    const myAvgObj = classAvgs.find((x) => x.id === student.id);
    averageScore = myAvgObj ? Number(myAvgObj.score.toFixed(1)) : null;
  }

  const jhsAggregate =
    department === "JHS" ? calculateJhsBeceAggregate(myAssessments) : null;

  return NextResponse.json({
    role: user.role,
    published: reportCard?.status === "PUBLISHED",
    school,
    terms,
    term: activeTerm,
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      fullName: `${student.firstName} ${student.lastName}`,
      gender: student.gender,
      classroomId: student.classroomId,
      classroomName: student.classroom?.name || "Unassigned",
      department,
      classTeacher: student.classroom?.teacher?.fullName || "Unassigned",
      guardianName: student.guardianName || student.parent?.fullName || "—",
    },
    attendance: {
      presentDays,
      totalDays,
      rate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
    },
    subjects,
    overall: {
      averageScore,
      overallPosition,
      overallPositionLabel: formatOrdinal(overallPosition),
      classSize: classStudents.length,
      totalSubjects: subjects.length,
    },
    jhsAggregate,
    reportCard: reportCard || {
      status: "DRAFT",
      teacherRemarks: "",
      conduct: "",
      interest: "",
      headmasterRemarks: "",
      approvedBy: null,
      approvedAt: null,
      publishedAt: null,
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN", "TEACHER"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { studentId } = await context.params;
  try {
    const body = await request.json();
    const parsed = updateReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid report card update" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        classroom: true,
        parent: { select: { fullName: true, phone: true } },
      },
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }
    if (user.role === "TEACHER" && student.classroom?.teacherId !== user.id) {
      return NextResponse.json(
        { error: "You can only update report cards for your assigned classes." },
        { status: 403 }
      );
    }

    // Only Headmaster (SUPER_ADMIN) can Approve/Publish or Unpublish
    if (
      (parsed.data.action === "PUBLISH" || parsed.data.action === "UNPUBLISH") &&
      user.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only the Headmaster can approve and publish Terminal Report Cards." },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.teacherRemarks !== undefined) {
      updateData.teacherRemarks = parsed.data.teacherRemarks?.trim() || null;
    }
    if (parsed.data.conduct !== undefined) {
      updateData.conduct = parsed.data.conduct?.trim() || null;
    }
    if (parsed.data.interest !== undefined) {
      updateData.interest = parsed.data.interest?.trim() || null;
    }
    if (
      user.role === "SUPER_ADMIN" &&
      parsed.data.headmasterRemarks !== undefined
    ) {
      updateData.headmasterRemarks =
        parsed.data.headmasterRemarks?.trim() || null;
    }

    if (parsed.data.action === "SUBMIT_APPROVAL") {
      updateData.status = "PENDING_APPROVAL";
    } else if (parsed.data.action === "PUBLISH") {
      const now = new Date();
      updateData.status = "PUBLISHED";
      updateData.approvedById = user.id;
      updateData.approvedAt = now;
      updateData.publishedAt = now;
    } else if (parsed.data.action === "UNPUBLISH") {
      updateData.status = "DRAFT";
      updateData.approvedById = null;
      updateData.approvedAt = null;
      updateData.publishedAt = null;
    }

    const saved = await prisma.termReportCard.upsert({
      where: {
        studentId_termId: { studentId, termId: parsed.data.termId },
      },
      update: updateData,
      create: {
        studentId,
        termId: parsed.data.termId,
        teacherRemarks: (updateData.teacherRemarks as string | null) ?? null,
        conduct: (updateData.conduct as string | null) ?? null,
        interest: (updateData.interest as string | null) ?? null,
        headmasterRemarks:
          (updateData.headmasterRemarks as string | null) ?? null,
        status: (updateData.status as string) || "DRAFT",
        approvedById: (updateData.approvedById as string | null) ?? null,
        approvedAt: (updateData.approvedAt as Date | null) ?? null,
        publishedAt: (updateData.publishedAt as Date | null) ?? null,
      },
      include: { approvedBy: { select: { fullName: true } } },
    });

    // Auto-trigger Report Card Published SMS when Headmaster approves & publishes
    if (parsed.data.action === "PUBLISH") {
      const phone = student.guardianPhone || student.parent?.phone;
      if (phone) {
        const [school, term] = await Promise.all([
          prisma.schoolProfile.findUnique({ where: { id: "default" } }),
          prisma.academicTerm.findUnique({ where: { id: parsed.data.termId } }),
        ]);
        await sendSms({
          recipientPhone: phone,
          recipientName:
            student.guardianName ||
            student.parent?.fullName ||
            `Parent of ${student.firstName}`,
          message: `${school?.schoolName || "Sankofa Preparatory & JHS"}: ${term?.termName || "Term"} Terminal Report Card for ${student.firstName} ${student.lastName} (${student.classroom?.name || ""}) has been approved by the Headmaster and is now published in your Parent Portal.`,
          eventType: "REPORT_PUBLISHED",
          sentById: user.id,
        });
      }
    }

    return NextResponse.json({ reportCard: saved });
  } catch (err) {
    console.error("Update report card error:", err);
    return NextResponse.json(
      { error: "Failed to save report card changes." },
      { status: 500 }
    );
  }
}
