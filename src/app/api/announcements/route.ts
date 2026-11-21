import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(3, "Title is required"),
  content: z.string().min(5, "Message content is required"),
  audience: z.enum(["ALL", "TEACHERS", "PARENTS", "STAFF"]).default("ALL"),
  targetDepartment: z
    .enum(["ALL", "CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"])
    .default("ALL"),
  pinned: z.boolean().optional(),
});

export async function GET() {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
    "PARENT",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  let where: Record<string, unknown> | undefined = undefined;

  if (user.role === "PARENT") {
    const wards = await prisma.student.findMany({
      where: { parentId: user.id, status: "ACTIVE" },
      select: { classroom: { select: { department: true } } },
    });
    const wardDepts = Array.from(
      new Set(wards.map((w) => w.classroom?.department).filter(Boolean))
    ) as string[];
    where = {
      audience: { in: ["ALL", "PARENTS"] },
      targetDepartment: { in: ["ALL", ...wardDepts] },
    };
  } else if (user.role === "TEACHER") {
    const classes = await prisma.classroom.findMany({
      where: { teacherId: user.id },
      select: { department: true },
    });
    const teacherDepts = Array.from(new Set(classes.map((c) => c.department)));
    where = {
      audience: { in: ["ALL", "TEACHERS", "STAFF"] },
      targetDepartment: { in: ["ALL", ...teacherDepts] },
    };
  } else if (user.role === "BURSAR") {
    where = { audience: { in: ["ALL", "STAFF"] } };
  }

  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { id: true, fullName: true, role: true } },
    },
  });

  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid announcement" },
        { status: 400 }
      );
    }

    const created = await prisma.announcement.create({
      data: {
        title: parsed.data.title.trim(),
        content: parsed.data.content.trim(),
        audience: parsed.data.audience,
        targetDepartment: parsed.data.targetDepartment,
        pinned: user.role === "SUPER_ADMIN" ? Boolean(parsed.data.pinned) : false,
        authorId: user.id,
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
      },
    });

    return NextResponse.json({ announcement: created }, { status: 201 });
  } catch (err) {
    console.error("Create announcement error:", err);
    return NextResponse.json(
      { error: "Failed to post announcement." },
      { status: 500 }
    );
  }
}
