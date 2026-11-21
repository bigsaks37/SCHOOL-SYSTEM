import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateStudentSchema = z.object({
  admissionNo: z.string().min(2).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  dateOfBirth: z.string().optional().nullable(),
  nhisNumber: z.string().optional().nullable(),
  guardianName: z.string().max(120).optional().nullable(),
  guardianPhone: z.string().max(30).optional().nullable(),
  guardianNote: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "GRADUATED", "TRANSFERRED"]).optional(),
  classroomId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
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
    const parsed = updateStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        ...(parsed.data.admissionNo !== undefined
          ? { admissionNo: parsed.data.admissionNo.trim() }
          : {}),
        ...(parsed.data.firstName !== undefined
          ? { firstName: parsed.data.firstName.trim() }
          : {}),
        ...(parsed.data.lastName !== undefined
          ? { lastName: parsed.data.lastName.trim() }
          : {}),
        ...(parsed.data.gender !== undefined ? { gender: parsed.data.gender } : {}),
        ...(parsed.data.dateOfBirth !== undefined
          ? { dateOfBirth: parsed.data.dateOfBirth || null }
          : {}),
        ...(parsed.data.nhisNumber !== undefined
          ? { nhisNumber: parsed.data.nhisNumber?.trim() || null }
          : {}),
        ...(parsed.data.guardianName !== undefined
          ? { guardianName: parsed.data.guardianName?.trim() || null }
          : {}),
        ...(parsed.data.guardianPhone !== undefined
          ? { guardianPhone: parsed.data.guardianPhone?.trim() || null }
          : {}),
        ...(parsed.data.guardianNote !== undefined
          ? { guardianNote: parsed.data.guardianNote?.trim() || null }
          : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.classroomId !== undefined
          ? { classroomId: parsed.data.classroomId || null }
          : {}),
        ...(parsed.data.parentId !== undefined
          ? { parentId: parsed.data.parentId || null }
          : {}),
      },
      include: {
        classroom: { select: { id: true, name: true, department: true } },
        parent: { select: { id: true, fullName: true, phone: true } },
      },
    });

    return NextResponse.json({ student: updated });
  } catch (err) {
    console.error("Update student error:", err);
    return NextResponse.json(
      { error: "Failed to update student record." },
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
    await prisma.student.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete student error:", err);
    return NextResponse.json(
      { error: "Failed to delete student." },
      { status: 500 }
    );
  }
}
