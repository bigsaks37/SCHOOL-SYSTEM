import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaystackConfig } from "@/lib/paystack";
import { sendSms } from "@/lib/smsService";
import { formatGHS } from "@/lib/format";

const paymentSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  termId: z.string().optional(),
  amountPaid: z.coerce.number().positive("Payment amount must be greater than 0"),
  paymentMethod: z.enum(["MOMO", "CASH", "BANK_TRANSFER"]),
  momoNetwork: z.enum(["MTN", "TELECEL", "AT"]).optional().nullable(),
  feeItemLabel: z.string().max(160).optional().nullable(),
  reference: z.string().max(80).optional().nullable(),
  notes: z.string().max(250).optional().nullable(),
});

function feeAppliesToStudent(
  fee: { department: string; classroomId: string | null },
  studentDept: string,
  studentClassId: string | null
) {
  if (fee.classroomId) {
    return fee.classroomId === studentClassId;
  }
  return fee.department === "ALL" || fee.department === studentDept;
}

export async function GET(request: Request) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const requestedTermId = searchParams.get("termId");

  const [terms, classrooms] = await Promise.all([
    prisma.academicTerm.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
    prisma.classroom.findMany({
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select: { id: true, name: true, department: true },
    }),
  ]);

  const activeTerm =
    terms.find((t) => t.id === requestedTermId) ||
    terms.find((t) => t.isCurrent) ||
    terms[0];

  const paystackCfg = getPaystackConfig();

  if (!activeTerm) {
    return NextResponse.json({
      terms: [],
      activeTermId: "",
      classrooms,
      structures: [],
      ledger: [],
      payments: [],
      totals: {
        expected: 0,
        collected: 0,
        arrears: 0,
        todayCollections: 0,
        todayReceiptsCount: 0,
        debtorsCount: 0,
      },
      paystack: {
        mode: paystackCfg.isConfigured ? "LIVE" : "SIMULATION",
      },
    });
  }

  const studentWhere =
    user.role === "PARENT" ? { parentId: user.id } : { status: "ACTIVE" };

  const [structures, students, payments] = await Promise.all([
    prisma.feeStructure.findMany({
      where: { termId: activeTerm.id },
      orderBy: [{ department: "asc" }, { category: "asc" }, { createdAt: "asc" }],
      include: {
        classroom: { select: { id: true, name: true, department: true } },
      },
    }),
    prisma.student.findMany({
      where: studentWhere,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        classroom: { select: { id: true, name: true, department: true } },
        parent: { select: { fullName: true, phone: true, email: true } },
        payments: {
          where: { termId: activeTerm.id },
          orderBy: { paidAt: "desc" },
        },
      },
    }),
    prisma.feePayment.findMany({
      where: {
        termId: activeTerm.id,
        ...(user.role === "PARENT" ? { student: { parentId: user.id } } : {}),
      },
      orderBy: { paidAt: "desc" },
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
        recordedBy: { select: { fullName: true } },
      },
    }),
  ]);

  let expected = 0;
  let collected = 0;
  let debtorsCount = 0;

  const ledger = students.map((s) => {
    const dept = s.classroom?.department || "PRIMARY";
    const applicableFees = structures.filter((f) =>
      feeAppliesToStudent(f, dept, s.classroomId)
    );
    const totalBilled = applicableFees.reduce((sum, f) => sum + f.amount, 0);
    const totalPaid = s.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const balance = Math.max(0, Number((totalBilled - totalPaid).toFixed(2)));

    expected += totalBilled;
    collected += totalPaid;
    if (balance > 0) debtorsCount += 1;

    let feeStatus: "PAID" | "PARTIAL" | "OWING" = "OWING";
    if (totalBilled > 0 && balance <= 0) feeStatus = "PAID";
    else if (totalPaid > 0 && balance > 0) feeStatus = "PARTIAL";

    return {
      studentId: s.id,
      admissionNo: s.admissionNo,
      fullName: `${s.firstName} ${s.lastName}`,
      classroomId: s.classroomId,
      classroom: s.classroom?.name || "Unassigned",
      department: dept,
      parentName: s.guardianName || s.parent?.fullName || "—",
      parentPhone: s.guardianPhone || s.parent?.phone || "—",
      parentEmail: s.parent?.email || null,
      totalBilled,
      totalPaid,
      balance,
      feeStatus,
      breakdown: applicableFees,
    };
  });

  // Today's Collections in GHS
  const todayIso = new Date().toISOString().slice(0, 10);
  const todaysPayments = payments.filter(
    (p) => p.paidAt.toISOString().slice(0, 10) === todayIso
  );
  const todayCollections = todaysPayments.reduce(
    (sum, p) => sum + p.amountPaid,
    0
  );

  return NextResponse.json({
    terms,
    activeTermId: activeTerm.id,
    classrooms,
    structures,
    ledger,
    payments,
    totals: {
      expected,
      collected,
      arrears: Math.max(0, Number((expected - collected).toFixed(2))),
      todayCollections,
      todayReceiptsCount: todaysPayments.length,
      debtorsCount,
    },
    paystack: {
      mode: paystackCfg.isConfigured ? "LIVE" : "SIMULATION",
    },
  });
}

export async function POST(request: Request) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN", "BURSAR"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid payment data" },
        { status: 400 }
      );
    }

    let termId = parsed.data.termId;
    if (!termId) {
      const current = await prisma.academicTerm.findFirst({
        where: { isCurrent: true },
      });
      if (!current) {
        return NextResponse.json(
          { error: "No active academic term configured." },
          { status: 400 }
        );
      }
      termId = current.id;
    }

    const year = new Date().getFullYear();
    let receiptNo = `RCP-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    while (await prisma.feePayment.findUnique({ where: { receiptNo } })) {
      receiptNo = `RCP-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const payment = await prisma.feePayment.create({
      data: {
        receiptNo,
        studentId: parsed.data.studentId,
        termId,
        amountPaid: parsed.data.amountPaid,
        paymentMethod: parsed.data.paymentMethod,
        momoNetwork:
          parsed.data.paymentMethod === "MOMO"
            ? parsed.data.momoNetwork || "MTN"
            : null,
        channel: "DESK",
        feeItemLabel:
          parsed.data.feeItemLabel?.trim() || "Term School Fees Payment",
        reference: parsed.data.reference?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
        recordedById: user.id,
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            firstName: true,
            lastName: true,
            classroomId: true,
            guardianName: true,
            guardianPhone: true,
            classroom: { select: { name: true, department: true } },
            parent: { select: { fullName: true, phone: true } },
          },
        },
        recordedBy: { select: { fullName: true } },
      },
    });

    // Auto-trigger Fee Payment Receipt SMS to Guardian
    const phone =
      payment.student.guardianPhone || payment.student.parent?.phone;
    if (phone) {
      const [school, termStructures, studentPayments] = await Promise.all([
        prisma.schoolProfile.findUnique({ where: { id: "default" } }),
        prisma.feeStructure.findMany({ where: { termId } }),
        prisma.feePayment.findMany({
          where: { studentId: payment.student.id, termId },
        }),
      ]);
      const dept = payment.student.classroom?.department || "PRIMARY";
      const totalBilled = termStructures
        .filter((f) => feeAppliesToStudent(f, dept, payment.student.classroomId))
        .reduce((sum, f) => sum + f.amount, 0);
      const totalPaid = studentPayments.reduce((sum, p) => sum + p.amountPaid, 0);
      const remaining = Math.max(0, totalBilled - totalPaid);
      const schoolName = school?.schoolName || "Sankofa Preparatory & JHS";

      await sendSms({
        recipientPhone: phone,
        recipientName:
          payment.student.guardianName ||
          payment.student.parent?.fullName ||
          `Parent of ${payment.student.firstName}`,
        message: `${schoolName}: Official Receipt ${payment.receiptNo} for ${payment.student.firstName} ${payment.student.lastName}. Paid: ${formatGHS(payment.amountPaid)}. Remaining Balance: ${formatGHS(remaining)}. Thank you!`,
        eventType: "FEE_RECEIPT",
        sentById: user.id,
      });
    }

    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    console.error("Record payment error:", err);
    return NextResponse.json(
      { error: "Failed to record fee payment." },
      { status: 500 }
    );
  }
}
