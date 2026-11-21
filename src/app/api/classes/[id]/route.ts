import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateClassSchema = z.object({
  name: z.string().min(2).optional(),
  department: z.enum(["CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"]).optional(),
  capacity: z.coerce.number().int().min(5).max(100).optional(),
  teacherId: z.string().optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    const body = await request.json();
    const parsed = updateClassSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const updated = await prisma.classroom.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.department !== undefined
          ? { department: parsed.data.department }
          : {}),
        ...(parsed.data.capacity !== undefined
          ? { capacity: parsed.data.capacity }
          : {}),
        ...(parsed.data.teacherId !== undefined
          ? { teacherId: parsed.data.teacherId || null }
          : {}),
      },
      include: {
        teacher: { select: { id: true, fullName: true, email: true, phone: true } },
        _count: { select: { students: true } },
      },
    });

    return NextResponse.json({ classroom: updated });
  } catch (err) {
    console.error("Update class error:", err);
    return NextResponse.json(
      { error: "Failed to update class. Name may already exist." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    await prisma.classroom.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete class error:", err);
    return NextResponse.json(
      { error: "Failed to delete classroom." },
      { status: 500 }
    );
  }
}
