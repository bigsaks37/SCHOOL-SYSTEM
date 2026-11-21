import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateJhsBeceAggregate } from "@/lib/grading";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentTerm = await prisma.academicTerm.findFirst({
    where: { isCurrent: true },
  });

  // 1. PARENT PORTAL SUMMARY (Multi-Child + Department-Aware)
  if (user.role === "PARENT") {
    const wards = await prisma.student.findMany({
      where: { parentId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: {
        classroom: {
          include: { teacher: { select: { fullName: true, phone: true } } },
        },
        payments: currentTerm
          ? {
              where: { termId: currentTerm.id },
              orderBy: { paidAt: "desc" },
            }
          : { orderBy: { paidAt: "desc" } },
        attendance: { orderBy: { date: "desc" }, take: 15 },
        assessments: currentTerm
          ? { where: { termId: currentTerm.id } }
          : true,
        careLogs: { orderBy: { date: "desc" }, take: 3 },
        reportCards: currentTerm
          ? {
              where: { termId: currentTerm.id },
              include: { approvedBy: { select: { fullName: true } } },
            }
          : false,
      },
    });

    const wardDepts = Array.from(
      new Set(wards.map((w) => w.classroom?.department).filter(Boolean))
    ) as string[];

    const [feeStructures, announcements] = await Promise.all([
      currentTerm
        ? prisma.feeStructure.findMany({
            where: { termId: currentTerm.id },
            orderBy: [{ category: "asc" }, { createdAt: "asc" }],
          })
        : Promise.resolve([]),
      prisma.announcement.findMany({
        where: {
          audience: { in: ["ALL", "PARENTS"] },
          targetDepartment: { in: ["ALL", ...wardDepts] },
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 6,
        include: {
          author: { select: { fullName: true, role: true } },
        },
      }),
    ]);

    let totalBilled = 0;
    let totalPaid = 0;
    let totalAttendance = 0;
    let presentCount = 0;

    const wardSummaries = wards.map((w) => {
      const dept = w.classroom?.department || "PRIMARY";
      const itemizedBill = feeStructures.filter((f) =>
        f.classroomId
          ? f.classroomId === w.classroomId
          : f.department === "ALL" || f.department === dept
      );
      const billed = itemizedBill.reduce((sum, f) => sum + f.amount, 0);
      const paid = w.payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const balance = Math.max(0, Number((billed - paid).toFixed(2)));
      totalBilled += billed;
      totalPaid += paid;

      totalAttendance += w.attendance.length;
      const wardPresent = w.attendance.filter(
        (a) => a.status === "PRESENT" || a.status === "LATE"
      ).length;
      presentCount += wardPresent;

      const avgScore =
        dept !== "KINDERGARTEN" && w.assessments.length > 0
          ? Number(
              (
                w.assessments.reduce((s, a) => s + a.totalScore, 0) /
                w.assessments.length
              ).toFixed(1)
            )
          : null;

      const jhsAgg =
        dept === "JHS" ? calculateJhsBeceAggregate(w.assessments) : null;

      const rc =
        Array.isArray(w.reportCards) && w.reportCards.length > 0
          ? w.reportCards[0]
          : null;

      const todayCareLog =
        w.careLogs.find((c) => c.date === today) || w.careLogs[0] || null;

      const feeStatus: "PAID" | "PARTIAL" | "OWING" =
        billed > 0 && balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "OWING";

      return {
        id: w.id,
        admissionNo: w.admissionNo,
        fullName: `${w.firstName} ${w.lastName}`,
        gender: w.gender,
        classroom: w.classroom?.name || "Unassigned",
        department: dept,
        teacherName: w.classroom?.teacher?.fullName || "Unassigned",
        teacherPhone: w.classroom?.teacher?.phone || null,
        billed,
        paid,
        balance,
        feeStatus,
        itemizedBill,
        recentReceipts: w.payments.slice(0, 5).map((p) => ({
          id: p.id,
          receiptNo: p.receiptNo,
          amountPaid: p.amountPaid,
          paymentMethod: p.paymentMethod,
          momoNetwork: p.momoNetwork,
          paidAt: p.paidAt,
          feeItemLabel: p.feeItemLabel,
        })),
        attendanceRate:
          w.attendance.length > 0
            ? Math.round((wardPresent / w.attendance.length) * 100)
            : 100,
        recentAttendance: w.attendance.slice(0, 6).map((a) => ({
          id: a.id,
          date: a.date,
          status: a.status,
          remarks: a.remarks,
        })),
        avgScore,
        jhsAggregate: jhsAgg?.aggregate ?? null,
        reportCard: {
          status: rc?.status || "DRAFT",
          published: rc?.status === "PUBLISHED",
          approvedAt: rc?.approvedAt || null,
        },
        crecheCareLog: dept === "CRECHE" ? todayCareLog : null,
      };
    });

    return NextResponse.json({
      role: user.role,
      currentTerm,
      parentPhone: user.phone,
      stats: {
        wardsCount: wards.length,
        totalBilled,
        totalPaid,
        outstandingBalance: Math.max(0, Number((totalBilled - totalPaid).toFixed(2))),
        attendanceRate:
          totalAttendance > 0
            ? Math.round((presentCount / totalAttendance) * 100)
            : 100,
      },
      wardSummaries,
      announcements,
    });
  }

  // 2. TEACHER PORTAL SUMMARY (Strictly scoped to assigned classes & subjects)
  if (user.role === "TEACHER") {
    const [teacherProfile, assignedClasses] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { staffId: true, subjects: true, qualification: true },
      }),
      prisma.classroom.findMany({
        where: { teacherId: user.id },
        orderBy: [{ department: "asc" }, { name: "asc" }],
        include: {
          _count: { select: { students: { where: { status: "ACTIVE" } } } },
        },
      }),
    ]);

    const classIds = assignedClasses.map((c) => c.id);
    const teacherDepts = Array.from(
      new Set(assignedClasses.map((c) => c.department))
    );
    const crecheClassIds = assignedClasses
      .filter((c) => c.department === "CRECHE")
      .map((c) => c.id);

    const [todayClassAttendance, todayCrecheLogs, announcements] =
      await Promise.all([
        classIds.length > 0
          ? prisma.attendanceRecord.findMany({
              where: { classroomId: { in: classIds }, date: today },
            })
          : Promise.resolve([]),
        crecheClassIds.length > 0
          ? prisma.crecheCareLog.findMany({
              where: { classroomId: { in: crecheClassIds }, date: today },
              include: {
                student: { select: { firstName: true, lastName: true } },
                classroom: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
        prisma.announcement.findMany({
          where: {
            audience: { in: ["ALL", "TEACHERS", "STAFF"] },
            targetDepartment: { in: ["ALL", ...teacherDepts] },
          },
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
          take: 4,
          include: {
            author: { select: { fullName: true, role: true } },
          },
        }),
      ]);

    const myStudentsCount = assignedClasses.reduce(
      (sum, c) => sum + c._count.students,
      0
    );
    const presentToday = todayClassAttendance.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const markedToday = todayClassAttendance.length;
    const attendanceRateToday =
      markedToday > 0 ? Math.round((presentToday / markedToday) * 100) : 0;

    const mySubjects = teacherProfile?.subjects
      ? teacherProfile.subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const classesWithTodayStats = assignedClasses.map((cls) => {
      const clsAtt = todayClassAttendance.filter((a) => a.classroomId === cls.id);
      const clsPresent = clsAtt.filter(
        (a) => a.status === "PRESENT" || a.status === "LATE"
      ).length;
      const clsCareLogged = todayCrecheLogs.filter(
        (l) => l.classroomId === cls.id
      ).length;

      return {
        ...cls,
        todayMarked: clsAtt.length,
        todayPresent: clsPresent,
        todayRate:
          clsAtt.length > 0 ? Math.round((clsPresent / clsAtt.length) * 100) : null,
        todayCareLogged: cls.department === "CRECHE" ? clsCareLogged : null,
      };
    });

    return NextResponse.json({
      role: user.role,
      currentTerm,
      stats: {
        activeStudentsCount: myStudentsCount,
        assignedClassesCount: assignedClasses.length,
        subjectsCount: mySubjects.length,
        presentToday,
        markedToday,
        attendanceRateToday,
        crecheLogsToday: todayCrecheLogs.length,
      },
      teacherInfo: {
        staffId: teacherProfile?.staffId || null,
        qualification: teacherProfile?.qualification || null,
        subjects: mySubjects,
        hasCrecheClass: crecheClassIds.length > 0,
      },
      classes: classesWithTodayStats,
      announcements,
    });
  }

  // 3. HEADMASTER (SUPER_ADMIN) & ACCOUNTANT (BURSAR) SUMMARY
  const [
    totalStudents,
    activeStudents,
    totalClasses,
    totalTeachers,
    totalStaff,
    todayAttendance,
    feeStructures,
    termPayments,
    recentPayments,
    allClassrooms,
    todayCrecheLogs,
    announcements,
    smsCount,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        classroomId: true,
        classroom: { select: { department: true } },
      },
    }),
    prisma.classroom.count(),
    prisma.user.count({
      where: { role: "TEACHER", isActive: true },
    }),
    prisma.user.count({
      where: { role: { in: ["SUPER_ADMIN", "BURSAR", "TEACHER"] }, isActive: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: today },
      include: { classroom: { select: { department: true } } },
    }),
    currentTerm
      ? prisma.feeStructure.findMany({ where: { termId: currentTerm.id } })
      : Promise.resolve([]),
    currentTerm
      ? prisma.feePayment.findMany({ where: { termId: currentTerm.id } })
      : Promise.resolve([]),
    prisma.feePayment.findMany({
      orderBy: { paidAt: "desc" },
      take: 5,
      include: {
        student: { select: { firstName: true, lastName: true, admissionNo: true } },
      },
    }),
    prisma.classroom.findMany({
      include: {
        teacher: { select: { fullName: true } },
        _count: { select: { students: true } },
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
    prisma.crecheCareLog.findMany({
      where: { date: today },
      orderBy: { updatedAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            firstName: true,
            lastName: true,
          },
        },
        classroom: { select: { id: true, name: true } },
        recordedBy: { select: { fullName: true } },
      },
    }),
    prisma.announcement.findMany({
      where: user.role === "BURSAR" ? { audience: { in: ["ALL", "STAFF"] } } : undefined,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: {
        author: { select: { fullName: true, role: true } },
      },
    }),
    prisma.smsLog.count(),
  ]);

  let expectedRevenue = 0;
  let debtorsCount = 0;
  const deptCounts: Record<string, number> = {
    CRECHE: 0,
    KINDERGARTEN: 0,
    PRIMARY: 0,
    JHS: 0,
  };

  for (const st of activeStudents) {
    const dept = st.classroom?.department || "PRIMARY";
    if (deptCounts[dept] !== undefined) {
      deptCounts[dept] += 1;
    }
    const studentBill = feeStructures
      .filter((f) =>
        f.classroomId
          ? f.classroomId === st.classroomId
          : f.department === "ALL" || f.department === dept
      )
      .reduce((sum, f) => sum + f.amount, 0);
    expectedRevenue += studentBill;

    const studentPaid = termPayments
      .filter((p) => p.studentId === st.id)
      .reduce((sum, p) => sum + p.amountPaid, 0);
    if (studentBill > studentPaid) {
      debtorsCount += 1;
    }
  }

  const todaysPayments = termPayments.filter(
    (p) => p.paidAt.toISOString().slice(0, 10) === today
  );
  const todayCollections = todaysPayments.reduce(
    (sum, p) => sum + p.amountPaid,
    0
  );

  const deptClassCounts: Record<string, number> = {
    CRECHE: 0,
    KINDERGARTEN: 0,
    PRIMARY: 0,
    JHS: 0,
  };
  for (const cls of allClassrooms) {
    if (deptClassCounts[cls.department] !== undefined) {
      deptClassCounts[cls.department] += 1;
    }
  }

  const departmentKeys = ["CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"] as const;

  const enrollmentByDepartment = departmentKeys.map((key) => ({
    department: key,
    students: deptCounts[key],
    classes: deptClassCounts[key],
  }));

  const attendanceByDepartment = departmentKeys.map((key) => {
    const records = todayAttendance.filter((a) => a.classroom.department === key);
    const present = records.filter((a) => a.status === "PRESENT").length;
    const late = records.filter((a) => a.status === "LATE").length;
    const absent = records.filter(
      (a) => a.status === "ABSENT" || a.status === "EXCUSED"
    ).length;
    const marked = records.length;
    const rate =
      marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;

    return {
      department: key,
      totalStudents: deptCounts[key],
      present,
      late,
      absent,
      marked,
      rate,
    };
  });

  const crecheOversight = {
    date: today,
    totalCrecheStudents: deptCounts.CRECHE,
    loggedToday: todayCrecheLogs.length,
    pickupVerifiedToday: todayCrecheLogs.filter((l) => l.pickupVerified).length,
    refusedMealAlerts: todayCrecheLogs.filter(
      (l) => l.breakfastStatus === "REFUSED" || l.lunchStatus === "REFUSED"
    ).length,
    unwellAlerts: todayCrecheLogs.filter((l) => l.mood === "UNWELL").length,
    logs: todayCrecheLogs,
  };

  const collectedRevenue = termPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const presentToday = todayAttendance.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;
  const attendanceRateToday =
    todayAttendance.length > 0
      ? Math.round((presentToday / todayAttendance.length) * 100)
      : 0;

  return NextResponse.json({
    role: user.role,
    currentTerm,
    stats: {
      totalStudents,
      activeStudentsCount: activeStudents.length,
      totalClasses,
      totalTeachers,
      totalStaff,
      presentToday,
      markedToday: todayAttendance.length,
      attendanceRateToday,
      expectedRevenue,
      collectedRevenue,
      outstandingRevenue: Math.max(0, expectedRevenue - collectedRevenue),
      todayCollections,
      todayReceiptsCount: todaysPayments.length,
      debtorsCount,
      smsCount,
    },
    enrollmentByDepartment,
    attendanceByDepartment,
    crecheOversight,
    classes: allClassrooms,
    recentPayments,
    announcements,
  });
}
