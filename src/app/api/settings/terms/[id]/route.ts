import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateTermSchema = z.object({
  activate: z.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nextTermReopeningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal("")),
  classScoreWeight: z.coerce
    .number()
    .refine((v) => v === 30 || v === 50, "Class score weight must be 30 or 50")
    .optional(),
  primaryGradingScale: z.enum(["LETTER", "BECE"]).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Allow empty body for quick "Set Active" call
      body = { activate: true };
    }

    const parsed = updateTermSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid term update" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.startDate !== undefined) data.startDate = parsed.data.startDate;
    if (parsed.data.endDate !== undefined) data.endDate = parsed.data.endDate;
    if (parsed.data.nextTermReopeningDate !== undefined) {
      data.nextTermReopeningDate = parsed.data.nextTermReopeningDate || null;
    }
    if (parsed.data.classScoreWeight !== undefined) {
      data.classScoreWeight = parsed.data.classScoreWeight;
    }
    if (parsed.data.primaryGradingScale !== undefined) {
      data.primaryGradingScale = parsed.data.primaryGradingScale;
    }

    if (parsed.data.activate) {
      const [, updated] = await prisma.$transaction([
        prisma.academicTerm.updateMany({ data: { isCurrent: false } }),
        prisma.academicTerm.update({
          where: { id },
          data: { ...data, isCurrent: true },
        }),
      ]);
      return NextResponse.json({ success: true, term: updated });
    }

    const updated = await prisma.academicTerm.update({
      where: { id },
      data,
    });
    return NextResponse.json({ success: true, term: updated });
  } catch (err) {
    console.error("Update term error:", err);
    return NextResponse.json(
      { error: "Failed to update academic term." },
      { status: 500 }
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
    const term = await prisma.academicTerm.findUnique({ where: { id } });
    if (term?.isCurrent) {
      return NextResponse.json(
        { error: "Cannot delete the currently active academic term." },
        { status: 400 }
      );
    }

    await prisma.academicTerm.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete term error:", err);
    return NextResponse.json(
      { error: "Failed to delete academic term." },
      { status: 500 }
    );
  }
}
