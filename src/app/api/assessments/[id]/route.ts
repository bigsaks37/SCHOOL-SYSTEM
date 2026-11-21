import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeGesGrade } from "@/lib/format";

const updateSchema = z.object({
  classScore: z.coerce.number().min(0).max(50),
  examScore: z.coerce.number().min(0).max(50),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN", "TEACHER"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    const existing = await prisma.assessment.findUnique({
      where: { id },
      include: { student: { include: { classroom: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    if (
      user.role === "TEACHER" &&
      existing.student.classroom?.teacherId !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid scores" },
        { status: 400 }
      );
    }

    const totalScore = parsed.data.classScore + parsed.data.examScore;
    const { grade, remarks } = computeGesGrade(totalScore);

    const updated = await prisma.assessment.update({
      where: { id },
      data: {
        classScore: parsed.data.classScore,
        examScore: parsed.data.examScore,
        totalScore,
        grade,
        remarks,
        recordedById: user.id,
      },
    });

    return NextResponse.json({ assessment: updated });
  } catch (err) {
    console.error("Update assessment error:", err);
    return NextResponse.json(
      { error: "Failed to update assessment." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN", "TEACHER"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    const existing = await prisma.assessment.findUnique({
      where: { id },
      include: { student: { include: { classroom: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }
    if (
      user.role === "TEACHER" &&
      existing.student.classroom?.teacherId !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.assessment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete assessment error:", err);
    return NextResponse.json(
      { error: "Failed to delete assessment." },
      { status: 500 }
    );
  }
}
