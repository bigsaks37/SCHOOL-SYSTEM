import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().min(2).optional(),
  category: z
    .enum(["TUITION", "FEEDING", "TRANSPORT", "PTA", "BOOKS", "OTHER"])
    .optional(),
  amount: z.coerce.number().positive().optional(),
  department: z
    .enum(["ALL", "CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"])
    .optional(),
  classroomId: z.string().optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status } = await requireRole(["SUPER_ADMIN", "BURSAR"]);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const updated = await prisma.feeStructure.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined
          ? { title: parsed.data.title.trim() }
          : {}),
        ...(parsed.data.category !== undefined
          ? { category: parsed.data.category }
          : {}),
        ...(parsed.data.amount !== undefined
          ? { amount: parsed.data.amount }
          : {}),
        ...(parsed.data.department !== undefined
          ? { department: parsed.data.department }
          : {}),
        ...(parsed.data.classroomId !== undefined
          ? { classroomId: parsed.data.classroomId || null }
          : {}),
      },
      include: {
        classroom: { select: { id: true, name: true, department: true } },
      },
    });

    return NextResponse.json({ structure: updated });
  } catch (err) {
    console.error("Update fee structure error:", err);
    return NextResponse.json(
      { error: "Failed to update fee structure." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status } = await requireRole(["SUPER_ADMIN", "BURSAR"]);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    await prisma.feeStructure.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete fee structure error:", err);
    return NextResponse.json(
      { error: "Failed to delete fee structure." },
      { status: 500 }
    );
  }
}
