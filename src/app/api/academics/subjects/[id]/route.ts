import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    await prisma.departmentSubject.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete department subject error:", err);
    return NextResponse.json(
      { error: "Failed to remove subject." },
      { status: 500 }
    );
  }
}
