import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateTeacherSchema = z.object({
  staffId: z.string().optional().nullable(),
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional().nullable(),
  qualification: z.string().max(120).optional().nullable(),
  subjects: z.array(z.string()).optional(),
  classroomIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
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
    const parsed = updateTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.staffId !== undefined)
      updateData.staffId = parsed.data.staffId?.trim() || null;
    if (parsed.data.fullName !== undefined)
      updateData.fullName = parsed.data.fullName.trim();
    if (parsed.data.email !== undefined)
      updateData.email = parsed.data.email.trim().toLowerCase();
    if (parsed.data.phone !== undefined)
      updateData.phone = parsed.data.phone?.trim() || null;
    if (parsed.data.qualification !== undefined)
      updateData.qualification = parsed.data.qualification?.trim() || null;
    if (parsed.data.subjects !== undefined) {
      const joined = parsed.data.subjects
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", ");
      updateData.subjects = joined || null;
    }
    if (parsed.data.isActive !== undefined)
      updateData.isActive = parsed.data.isActive;
    if (parsed.data.password && parsed.data.password.length >= 6) {
      updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: updateData,
      });

      if (parsed.data.classroomIds !== undefined) {
        // Unassign classes previously assigned to this teacher that are no longer selected
        await tx.classroom.updateMany({
          where: {
            teacherId: id,
            id: { notIn: parsed.data.classroomIds },
          },
          data: { teacherId: null },
        });
        // Assign selected classes to this teacher
        if (parsed.data.classroomIds.length > 0) {
          await tx.classroom.updateMany({
            where: { id: { in: parsed.data.classroomIds } },
            data: { teacherId: id },
          });
        }
      }

      return tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          staffId: true,
          fullName: true,
          email: true,
          phone: true,
          qualification: true,
          subjects: true,
          isActive: true,
          assignedClasses: { select: { id: true, name: true, department: true } },
        },
      });
    });

    return NextResponse.json({ teacher: updated });
  } catch (err) {
    console.error("Update teacher error:", err);
    return NextResponse.json(
      { error: "Failed to update teacher. Email or Staff ID may already be in use." },
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
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete teacher error:", err);
    return NextResponse.json(
      { error: "Failed to delete teacher." },
      { status: 500 }
    );
  }
}
