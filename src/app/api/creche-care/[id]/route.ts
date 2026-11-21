import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status, user } = await requireRole(["SUPER_ADMIN", "TEACHER"]);
  if (error || !user) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    const existing = await prisma.crecheCareLog.findUnique({
      where: { id },
      include: { classroom: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Care log not found." }, { status: 404 });
    }
    if (user.role === "TEACHER" && existing.classroom.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await prisma.crecheCareLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete creche care log error:", err);
    return NextResponse.json(
      { error: "Failed to delete care log." },
      { status: 500 }
    );
  }
}
