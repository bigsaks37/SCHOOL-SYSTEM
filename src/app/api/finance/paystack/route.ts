import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializePaystackTransaction } from "@/lib/paystack";
import { sendSms } from "@/lib/smsService";
import { formatGHS } from "@/lib/format";

const paystackCheckoutSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  termId: z.string().optional(),
  amountGhs: z.coerce.number().positive("Amount must be greater than 0"),
  channelPreference: z.enum(["mobile_money", "card"]).default("mobile_money"),
  momoNetwork: z.enum(["MTN", "TELECEL", "AT"]).optional(),
  momoPhone: z.string().max(30).optional(),
  feeItemLabel: z.string().max(160).optional(),
});

export async function POST(request: Request) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = paystackCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid Paystack request" },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: parsed.data.studentId },
      include: {
        parent: { select: { email: true, fullName: true, phone: true } },
      },
    });
    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }
    if (user.role === "PARENT" && student.parentId !== user.id) {
      return NextResponse.json(
        { error: "You can only pay fees for your own wards." },
        { status: 403 }
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

    const paystackInit = await initializePaystackTransaction({
      email: student.parent?.email || user.email,
      amountGhs: parsed.data.amountGhs,
      studentAdmissionNo: student.admissionNo,
      studentName: `${student.firstName} ${student.lastName}`,
      channelPreference: parsed.data.channelPreference,
      momoNetwork: parsed.data.momoNetwork,
      momoPhone: parsed.data.momoPhone,
    });

    // If Live Paystack keys are configured, return authorizationUrl for redirect
    if (paystackInit.mode === "LIVE" && paystackInit.authorizationUrl) {
      return NextResponse.json({
        mode: "LIVE",
        authorizationUrl: paystackInit.authorizationUrl,
        reference: paystackInit.reference,
        message: paystackInit.gatewayMessage,
      });
    }

    // Simulation mode: record verified payment receipt directly in SQLite
    const year = new Date().getFullYear();
    let receiptNo = `RCP-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    while (await prisma.feePayment.findUnique({ where: { receiptNo } })) {
      receiptNo = `RCP-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const payment = await prisma.feePayment.create({
      data: {
        receiptNo,
        studentId: student.id,
        termId: term.id,
        amountPaid: parsed.data.amountGhs,
        paymentMethod:
          parsed.data.channelPreference === "mobile_money"
            ? "MOMO"
            : "BANK_TRANSFER",
        momoNetwork:
          parsed.data.channelPreference === "mobile_money"
            ? parsed.data.momoNetwork || "MTN"
            : null,
        channel: "PAYSTACK_SIMULATION",
        feeItemLabel:
          parsed.data.feeItemLabel?.trim() ||
          "Online School Fees Payment (Paystack)",
        reference: paystackInit.reference,
        notes: paystackInit.gatewayMessage,
        recordedById: user.id,
      },
      include: {
        student: {
          select: {
            admissionNo: true,
            firstName: true,
            lastName: true,
            classroom: { select: { name: true } },
          },
        },
      },
    });

    // Auto-trigger Fee Receipt SMS
    const guardianPhone =
      parsed.data.momoPhone || student.guardianPhone || student.parent?.phone;
    if (guardianPhone) {
      const school = await prisma.schoolProfile.findUnique({
        where: { id: "default" },
      });
      await sendSms({
        recipientPhone: guardianPhone,
        recipientName:
          student.guardianName ||
          student.parent?.fullName ||
          `Parent of ${student.firstName}`,
        message: `${school?.schoolName || "Sankofa Preparatory & JHS"}: Paystack payment confirmed! Receipt ${payment.receiptNo} for ${student.firstName} ${student.lastName}. Paid: ${formatGHS(payment.amountPaid)} (Ref: ${paystackInit.reference}).`,
        eventType: "FEE_RECEIPT",
        sentById: user.id,
      });
    }

    return NextResponse.json(
      {
        mode: "SIMULATION",
        reference: paystackInit.reference,
        message: paystackInit.gatewayMessage,
        payment,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Paystack checkout error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to process Paystack payment.",
      },
      { status: 500 }
    );
  }
}
