import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSmsGatewayConfig,
  sendBulkSms,
  sendSms,
  type SmsEventType,
} from "@/lib/smsService";
import { formatGHS } from "@/lib/format";

const sendBulkSchema = z.object({
  target: z.enum([
    "ALL_PARENTS",
    "DEBTORS",
    "DEPARTMENT_PARENTS",
    "ALL_TEACHERS",
    "SINGLE",
  ]),
  department: z.enum(["CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"]).optional(),
  singlePhone: z.string().optional(),
  singleName: z.string().optional(),
  message: z.string().min(5, "SMS message must be at least 5 characters").max(480),
});

export async function GET(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("eventType");
  const search = searchParams.get("search")?.trim();

  const where: Record<string, unknown> = {};
  if (eventType && eventType !== "ALL") where.eventType = eventType;
  if (search) {
    where.OR = [
      { recipientPhone: { contains: search, mode: "insensitive" } },
      { recipientName: { contains: search, mode: "insensitive" } },
      { message: { contains: search, mode: "insensitive" } },
    ];
  }

  const [logs, totalCount, absenceCount, receiptCount, reportCount, bulkCount] =
    await Promise.all([
      prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 120,
        include: { sentBy: { select: { fullName: true } } },
      }),
      prisma.smsLog.count(),
      prisma.smsLog.count({ where: { eventType: "ABSENCE_ALERT" } }),
      prisma.smsLog.count({ where: { eventType: "FEE_RECEIPT" } }),
      prisma.smsLog.count({ where: { eventType: "REPORT_PUBLISHED" } }),
      prisma.smsLog.count({
        where: {
          eventType: { in: ["BULK_PARENTS", "BULK_DEBTORS", "BULK_TEACHERS"] },
        },
      }),
    ]);

  const cfg = getSmsGatewayConfig();

  return NextResponse.json({
    gateway: {
      provider: cfg.provider,
      configuredProvider: cfg.configuredProvider,
      isLive: cfg.isLive,
      senderId: cfg.senderId,
    },
    stats: {
      totalCount,
      absenceCount,
      receiptCount,
      reportCount,
      bulkCount,
    },
    logs,
  });
}

export async function POST(request: Request) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = sendBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid SMS payload" },
        { status: 400 }
      );
    }

    const { target, department, singlePhone, singleName, message } = parsed.data;

    if (target === "SINGLE") {
      if (!singlePhone?.trim()) {
        return NextResponse.json(
          { error: "Recipient phone number is required." },
          { status: 400 }
        );
      }
      const saved = await sendSms({
        recipientPhone: singlePhone.trim(),
        recipientName: singleName?.trim() || "Recipient",
        message: message.trim(),
        eventType: "MANUAL",
        sentById: user.id,
      });
      return NextResponse.json({ sentCount: saved ? 1 : 0 }, { status: 201 });
    }

    if (target === "ALL_TEACHERS") {
      const teachers = await prisma.user.findMany({
        where: { role: "TEACHER", isActive: true, phone: { not: null } },
        select: { fullName: true, phone: true },
      });
      const sent = await sendBulkSms(
        teachers.map((t) => ({ phone: t.phone!, name: t.fullName })),
        message.trim(),
        "BULK_TEACHERS",
        user.id
      );
      return NextResponse.json({ sentCount: sent.length }, { status: 201 });
    }

    if (target === "DEBTORS") {
      const currentTerm = await prisma.academicTerm.findFirst({
        where: { isCurrent: true },
      });
      if (!currentTerm) {
        return NextResponse.json(
          { error: "No active academic term found." },
          { status: 400 }
        );
      }

      const [structures, students] = await Promise.all([
        prisma.feeStructure.findMany({ where: { termId: currentTerm.id } }),
        prisma.student.findMany({
          where: { status: "ACTIVE" },
          include: {
            classroom: { select: { id: true, name: true, department: true } },
            parent: { select: { fullName: true, phone: true } },
            payments: { where: { termId: currentTerm.id } },
          },
        }),
      ]);

      const recipients: Array<{
        phone: string;
        name: string;
        customMessage: string;
      }> = [];

      for (const s of students) {
        const dept = s.classroom?.department || "PRIMARY";
        const billed = structures
          .filter((f) =>
            f.classroomId
              ? f.classroomId === s.classroomId
              : f.department === "ALL" || f.department === dept
          )
          .reduce((sum, f) => sum + f.amount, 0);
        const paid = s.payments.reduce((sum, p) => sum + p.amountPaid, 0);
        const balance = Math.max(0, billed - paid);
        const phone = s.guardianPhone || s.parent?.phone;
        if (balance > 0 && phone) {
          const studentName = `${s.firstName} ${s.lastName}`;
          const personalized = message
            .trim()
            .replaceAll("{studentName}", studentName)
            .replaceAll("{balance}", formatGHS(balance));
          recipients.push({
            phone,
            name: s.guardianName || s.parent?.fullName || `Parent of ${studentName}`,
            customMessage: personalized,
          });
        }
      }

      const sent = await sendBulkSms(
        recipients,
        message.trim(),
        "BULK_DEBTORS",
        user.id
      );
      return NextResponse.json({ sentCount: sent.length }, { status: 201 });
    }

    // ALL_PARENTS or DEPARTMENT_PARENTS (deduplicated by phone number)
    const students = await prisma.student.findMany({
      where: {
        status: "ACTIVE",
        ...(target === "DEPARTMENT_PARENTS" && department
          ? { classroom: { department } }
          : {}),
      },
      include: {
        parent: { select: { fullName: true, phone: true } },
      },
    });

    const uniqueMap = new Map<string, { phone: string; name: string }>();
    for (const s of students) {
      const phone = s.guardianPhone || s.parent?.phone;
      if (!phone) continue;
      if (!uniqueMap.has(phone)) {
        uniqueMap.set(phone, {
          phone,
          name: s.guardianName || s.parent?.fullName || `Parent of ${s.firstName}`,
        });
      }
    }

    const eventType: SmsEventType = "BULK_PARENTS";
    const sent = await sendBulkSms(
      Array.from(uniqueMap.values()),
      message.trim(),
      eventType,
      user.id
    );

    return NextResponse.json({ sentCount: sent.length }, { status: 201 });
  } catch (err) {
    console.error("Bulk SMS error:", err);
    return NextResponse.json(
      { error: "Failed to dispatch SMS notifications." },
      { status: 500 }
    );
  }
}
