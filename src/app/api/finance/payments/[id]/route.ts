import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  const [school, payment] = await Promise.all([
    prisma.schoolProfile.findUnique({ where: { id: "default" } }),
    prisma.feePayment.findUnique({
      where: { id },
      include: {
        term: true,
        recordedBy: { select: { fullName: true, role: true, staffId: true } },
        student: {
          include: {
            classroom: { select: { id: true, name: true, department: true } },
            parent: { select: { id: true, fullName: true, phone: true } },
          },
        },
      },
    }),
  ]);

  if (!payment) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  if (user.role === "PARENT" && payment.student.parentId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const dept = payment.student.classroom?.department || "PRIMARY";
  const [structures, allTermPayments] = await Promise.all([
    prisma.feeStructure.findMany({
      where: { termId: payment.termId },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    }),
    prisma.feePayment.findMany({
      where: { studentId: payment.studentId, termId: payment.termId },
      orderBy: { paidAt: "asc" },
    }),
  ]);

  const itemizedBill = structures.filter((f) =>
    f.classroomId
      ? f.classroomId === payment.student.classroomId
      : f.department === "ALL" || f.department === dept
  );

  const totalBilled = itemizedBill.reduce((sum, f) => sum + f.amount, 0);
  const totalPaidToDate = allTermPayments.reduce(
    (sum, p) => sum + p.amountPaid,
    0
  );
  const remainingBalance = Math.max(
    0,
    Number((totalBilled - totalPaidToDate).toFixed(2))
  );
  const feeStatus: "PAID" | "PARTIAL" | "OWING" =
    totalBilled > 0 && remainingBalance <= 0
      ? "PAID"
      : totalPaidToDate > 0
      ? "PARTIAL"
      : "OWING";

  return NextResponse.json({
    school,
    payment: {
      id: payment.id,
      receiptNo: payment.receiptNo,
      paidAt: payment.paidAt,
      amountPaid: payment.amountPaid,
      paymentMethod: payment.paymentMethod,
      momoNetwork: payment.momoNetwork,
      channel: payment.channel,
      feeItemLabel: payment.feeItemLabel || "Term School Fees Payment",
      reference: payment.reference,
      notes: payment.notes,
      recordedBy: payment.recordedBy?.fullName || "Accounts Office",
    },
    term: payment.term,
    student: {
      id: payment.student.id,
      admissionNo: payment.student.admissionNo,
      fullName: `${payment.student.firstName} ${payment.student.lastName}`,
      classroomName: payment.student.classroom?.name || "Unassigned",
      department: dept,
      guardianName:
        payment.student.guardianName || payment.student.parent?.fullName || "—",
      guardianPhone:
        payment.student.guardianPhone || payment.student.parent?.phone || "—",
    },
    itemizedBill,
    balances: {
      totalBilled,
      totalPaidToDate,
      remainingBalance,
      feeStatus,
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status } = await requireRole(["SUPER_ADMIN", "BURSAR"]);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    await prisma.feePayment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete payment error:", err);
    return NextResponse.json(
      { error: "Failed to void payment receipt." },
      { status: 500 }
    );
  }
}
