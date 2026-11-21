import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeDepartmentGrade,
  computeRankMap,
  calculateJhsBeceAggregate,
  KG_MASTERY_MAP,
} from "@/lib/grading";

const batchAssessmentSchema = z.object({
  classroomId: z.string().min(1),
  termId: z.string().min(1),
  subject: z.string().min(2),
  subjectCategory: z.enum(["CORE", "ELECTIVE", "LEARNING_AREA"]).optional(),
  entries: z.array(
    z.object({
      studentId: z.string().min(1),
      classScore: z.coerce.number().min(0).max(100).optional(),
      examScore: z.coerce.number().min(0).max(100).optional(),
      masteryRating: z
        .enum(["EXCEEDING", "MEETING", "DEVELOPING", "NEEDS_SUPPORT"])
        .optional()
        .nullable(),
      remarks: z.string().max(250).optional().nullable(),
    })
  ),
});

const singleAssessmentSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  termId: z.string().optional(),
  subject: z.string().min(2, "Subject is required"),
  subjectCategory: z.enum(["CORE", "ELECTIVE", "LEARNING_AREA"]).optional(),
  classScore: z.coerce.number().min(0).max(100).default(0),
  examScore: z.coerce.number().min(0).max(100).default(0),
  masteryRating: z
    .enum(["EXCEEDING", "MEETING", "DEVELOPING", "NEEDS_SUPPORT"])
    .optional()
    .nullable(),
  remarks: z.string().max(250).optional().nullable(),
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
  const requestedClassId = searchParams.get("classroomId");

  const terms = await prisma.academicTerm.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });
  const activeTerm =
    terms.find((t) => t.id === requestedTermId) ||
    terms.find((t) => t.isCurrent) ||
    terms[0];

  if (!activeTerm) {
    return NextResponse.json({
      terms: [],
      activeTerm: null,
      classrooms: [],
      activeClass: null,
      departmentSubjects: [],
      students: [],
      assessments: [],
      broadsheet: [],
    });
  }

  // PARENT VIEW: show wards' assessments (published or summary)
  if (user.role === "PARENT") {
    const wards = await prisma.student.findMany({
      where: { parentId: user.id, status: "ACTIVE" },
      select: {
        id: true,
        admissionNo: true,
        firstName: true,
        lastName: true,
        classroom: { select: { id: true, name: true, department: true } },
      },
    });
    const wardIds = wards.map((w) => w.id);
    const assessments = await prisma.assessment.findMany({
      where: { termId: activeTerm.id, studentId: { in: wardIds } },
      orderBy: [{ subjectCategory: "asc" }, { subject: "asc" }],
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            firstName: true,
            lastName: true,
            classroom: { select: { id: true, name: true, department: true } },
          },
        },
      },
    });
    return NextResponse.json({
      role: user.role,
      terms,
      activeTerm,
      students: wards,
      assessments,
      classrooms: [],
      activeClass: null,
      departmentSubjects: [],
      broadsheet: [],
    });
  }

  // STAFF VIEW (SUPER_ADMIN or TEACHER) — exclude CRECHE from numeric grading by default, include KG, PRIMARY, JHS
  const classrooms = await prisma.classroom.findMany({
    where: {
      department: { in: ["KINDERGARTEN", "PRIMARY", "JHS"] },
      ...(user.role === "TEACHER" ? { teacherId: user.id } : {}),
    },
    orderBy: [{ department: "asc" }, { name: "asc" }],
    select: { id: true, name: true, department: true },
  });

  if (classrooms.length === 0) {
    return NextResponse.json({
      role: user.role,
      terms,
      activeTerm,
      classrooms: [],
      activeClass: null,
      departmentSubjects: [],
      students: [],
      assessments: [],
      broadsheet: [],
    });
  }

  const activeClass =
    classrooms.find((c) => c.id === requestedClassId) || classrooms[0];

  const [departmentSubjects, students, assessments, reportCards] =
    await Promise.all([
      prisma.departmentSubject.findMany({
        where: { department: activeClass.department },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      }),
      prisma.student.findMany({
        where: { classroomId: activeClass.id, status: "ACTIVE" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          admissionNo: true,
          firstName: true,
          lastName: true,
          classroom: { select: { id: true, name: true, department: true } },
        },
      }),
      prisma.assessment.findMany({
        where: {
          termId: activeTerm.id,
          student: { classroomId: activeClass.id, status: "ACTIVE" },
        },
        include: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              firstName: true,
              lastName: true,
              classroom: { select: { name: true, department: true } },
            },
          },
        },
      }),
      prisma.termReportCard.findMany({
        where: {
          termId: activeTerm.id,
          student: { classroomId: activeClass.id, status: "ACTIVE" },
        },
      }),
    ]);

  // Compute class broadsheet (averages, overall class position, JHS BECE aggregate)
  const studentTotals = students.map((s) => {
    const sAssessments = assessments.filter((a) => a.studentId === s.id);
    const avg =
      sAssessments.length > 0 && activeClass.department !== "KINDERGARTEN"
        ? Number(
            (
              sAssessments.reduce((sum, a) => sum + a.totalScore, 0) /
              sAssessments.length
            ).toFixed(1)
          )
        : 0;
    return { id: s.id, score: avg, count: sAssessments.length };
  });

  const rankMap = computeRankMap(
    studentTotals.filter((st) => st.count > 0).map(({ id, score }) => ({ id, score }))
  );

  const broadsheet = students.map((s) => {
    const sAssessments = assessments.filter((a) => a.studentId === s.id);
    const rc = reportCards.find((r) => r.studentId === s.id);
    const totalEntry = studentTotals.find((t) => t.id === s.id);
    const jhsAgg =
      activeClass.department === "JHS"
        ? calculateJhsBeceAggregate(sAssessments)
        : null;

    return {
      studentId: s.id,
      admissionNo: s.admissionNo,
      fullName: `${s.firstName} ${s.lastName}`,
      subjectsRecorded: sAssessments.length,
      averageScore:
        activeClass.department !== "KINDERGARTEN" && sAssessments.length > 0
          ? totalEntry?.score ?? 0
          : null,
      overallPosition:
        activeClass.department !== "KINDERGARTEN"
          ? rankMap.get(s.id) ?? null
          : null,
      classSize: students.length,
      jhsAggregate: jhsAgg,
      reportStatus: rc?.status || "DRAFT",
    };
  });

  return NextResponse.json({
    role: user.role,
    terms,
    activeTerm,
    classrooms,
    activeClass,
    departmentSubjects,
    students,
    assessments,
    broadsheet,
  });
}

export async function POST(request: Request) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN", "TEACHER"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();

    // BATCH MODE: Department-specific score entry sheet (KG Mastery OR Primary/JHS numeric scores)
    if (Array.isArray(body.entries)) {
      const parsed = batchAssessmentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors[0]?.message || "Invalid batch scores" },
          { status: 400 }
        );
      }

      const [classroom, term, deptSubject] = await Promise.all([
        prisma.classroom.findUnique({ where: { id: parsed.data.classroomId } }),
        prisma.academicTerm.findUnique({ where: { id: parsed.data.termId } }),
        prisma.departmentSubject.findFirst({
          where: { name: parsed.data.subject },
        }),
      ]);

      if (!classroom) {
        return NextResponse.json({ error: "Classroom not found." }, { status: 404 });
      }
      if (!term) {
        return NextResponse.json({ error: "Academic term not found." }, { status: 404 });
      }
      if (user.role === "TEACHER" && classroom.teacherId !== user.id) {
        return NextResponse.json(
          { error: "You can only enter grades for your assigned classes." },
          { status: 403 }
        );
      }

      const isKg = classroom.department === "KINDERGARTEN";
      const classWeight = term.classScoreWeight;
      const examWeight = 100 - classWeight;
      const subjectCategory =
        parsed.data.subjectCategory ||
        deptSubject?.category ||
        (isKg ? "LEARNING_AREA" : "CORE");

      // Validate score ceilings for Primary / JHS
      if (!isKg) {
        for (const e of parsed.data.entries) {
          const cs = Number(e.classScore ?? 0);
          const es = Number(e.examScore ?? 0);
          if (cs < 0 || cs > classWeight) {
            return NextResponse.json(
              { error: `Class Score must be between 0 and ${classWeight}.` },
              { status: 400 }
            );
          }
          if (es < 0 || es > examWeight) {
            return NextResponse.json(
              { error: `Exam Score must be between 0 and ${examWeight}.` },
              { status: 400 }
            );
          }
        }
      }

      await prisma.$transaction(
        parsed.data.entries.map((entry) => {
          if (isKg) {
            const rating = entry.masteryRating || "MEETING";
            return prisma.assessment.upsert({
              where: {
                studentId_termId_subject: {
                  studentId: entry.studentId,
                  termId: term.id,
                  subject: parsed.data.subject.trim(),
                },
              },
              update: {
                subjectCategory: "LEARNING_AREA",
                classScore: 0,
                examScore: 0,
                totalScore: 0,
                masteryRating: rating,
                grade: KG_MASTERY_MAP[rating] || "Meeting Expectation",
                remarks: entry.remarks?.trim() || null,
                recordedById: user.id,
              },
              create: {
                studentId: entry.studentId,
                termId: term.id,
                subject: parsed.data.subject.trim(),
                subjectCategory: "LEARNING_AREA",
                classScore: 0,
                examScore: 0,
                totalScore: 0,
                masteryRating: rating,
                grade: KG_MASTERY_MAP[rating] || "Meeting Expectation",
                remarks: entry.remarks?.trim() || null,
                recordedById: user.id,
              },
            });
          }

          const classScore = Number(entry.classScore ?? 0);
          const examScore = Number(entry.examScore ?? 0);
          const totalScore = Number((classScore + examScore).toFixed(1));
          const { grade, remarks } = computeDepartmentGrade(
            totalScore,
            classroom.department,
            term.primaryGradingScale
          );

          return prisma.assessment.upsert({
            where: {
              studentId_termId_subject: {
                studentId: entry.studentId,
                termId: term.id,
                subject: parsed.data.subject.trim(),
              },
            },
            update: {
              subjectCategory,
              classScore,
              examScore,
              totalScore,
              grade,
              masteryRating: null,
              remarks: entry.remarks?.trim() || remarks,
              recordedById: user.id,
            },
            create: {
              studentId: entry.studentId,
              termId: term.id,
              subject: parsed.data.subject.trim(),
              subjectCategory,
              classScore,
              examScore,
              totalScore,
              grade,
              masteryRating: null,
              remarks: entry.remarks?.trim() || remarks,
              recordedById: user.id,
            },
          });
        })
      );

      return NextResponse.json(
        { success: true, count: parsed.data.entries.length },
        { status: 201 }
      );
    }

    // SINGLE RECORD FALLBACK
    const parsed = singleAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid assessment input" },
        { status: 400 }
      );
    }

    const term = parsed.data.termId
      ? await prisma.academicTerm.findUnique({ where: { id: parsed.data.termId } })
      : await prisma.academicTerm.findFirst({ where: { isCurrent: true } });

    if (!term) {
      return NextResponse.json(
        { error: "No active academic term configured." },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: parsed.data.studentId },
      include: { classroom: true },
    });
    if (!student || !student.classroom) {
      return NextResponse.json({ error: "Student not assigned to a class." }, { status: 404 });
    }
    if (user.role === "TEACHER" && student.classroom.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const totalScore = parsed.data.classScore + parsed.data.examScore;
    const { grade, remarks } = computeDepartmentGrade(
      totalScore,
      student.classroom.department,
      term.primaryGradingScale
    );

    const saved = await prisma.assessment.upsert({
      where: {
        studentId_termId_subject: {
          studentId: student.id,
          termId: term.id,
          subject: parsed.data.subject.trim(),
        },
      },
      update: {
        subjectCategory: parsed.data.subjectCategory || "CORE",
        classScore: parsed.data.classScore,
        examScore: parsed.data.examScore,
        totalScore,
        grade,
        masteryRating: parsed.data.masteryRating || null,
        remarks: parsed.data.remarks || remarks,
        recordedById: user.id,
      },
      create: {
        studentId: student.id,
        termId: term.id,
        subject: parsed.data.subject.trim(),
        subjectCategory: parsed.data.subjectCategory || "CORE",
        classScore: parsed.data.classScore,
        examScore: parsed.data.examScore,
        totalScore,
        grade,
        masteryRating: parsed.data.masteryRating || null,
        remarks: parsed.data.remarks || remarks,
        recordedById: user.id,
      },
    });

    return NextResponse.json({ assessment: saved }, { status: 201 });
  } catch (err) {
    console.error("Save assessment error:", err);
    return NextResponse.json(
      { error: "Failed to save assessment scores." },
      { status: 500 }
    );
  }
}
