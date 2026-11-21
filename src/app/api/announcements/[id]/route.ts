import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  content: z.string().min(5).optional(),
  audience: z.enum(["ALL", "TEACHERS", "PARENTS", "STAFF"]).optional(),
  targetDepartment: z
    .enum(["ALL", "CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"])
    .optional(),
  pinned: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }
    if (user.role !== "SUPER_ADMIN" && existing.authorId !== user.id) {
      return NextResponse.json(
        { error: "You can only edit announcements you posted." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined
          ? { title: parsed.data.title.trim() }
          : {}),
        ...(parsed.data.content !== undefined
          ? { content: parsed.data.content.trim() }
          : {}),
        ...(parsed.data.audience !== undefined
          ? { audience: parsed.data.audience }
          : {}),
        ...(parsed.data.targetDepartment !== undefined
          ? { targetDepartment: parsed.data.targetDepartment }
          : {}),
        ...(parsed.data.pinned !== undefined && user.role === "SUPER_ADMIN"
          ? { pinned: parsed.data.pinned }
          : {}),
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
      },
    });

    return NextResponse.json({ announcement: updated });
  } catch (err) {
    console.error("Update announcement error:", err);
    return NextResponse.json(
      { error: "Failed to update announcement." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
  ]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }
    if (user.role !== "SUPER_ADMIN" && existing.authorId !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own announcements." },
        { status: 403 }
      );
    }

    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete announcement error:", err);
    return NextResponse.json(
      { error: "Failed to delete announcement." },
      { status: 500 }
    );
  }
}
