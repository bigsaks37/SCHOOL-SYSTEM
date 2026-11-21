import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schoolSchema = z.object({
  schoolName: z.string().min(2),
  motto: z.string().min(2),
  address: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email(),
  gesCode: z.string().min(2),
});

const termSchema = z.object({
  academicYear: z.string().min(4, "Academic year required (e.g. 2026/2027)"),
  termName: z.enum(["Term 1", "Term 2", "Term 3"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date required"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date required"),
  nextTermReopeningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal("")),
  classScoreWeight: z.coerce
    .number()
    .refine((v) => v === 30 || v === 50, "Class score weight must be 30% or 50%")
    .default(50),
  primaryGradingScale: z.enum(["LETTER", "BECE"]).default("LETTER"),
  isCurrent: z.boolean().optional(),
});

export async function GET() {
  const { error, status } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
    "PARENT",
  ]);
  if (error) return NextResponse.json({ error }, { status });

  const [school, terms, departmentSubjects] = await Promise.all([
    prisma.schoolProfile.findUnique({ where: { id: "default" } }),
    prisma.academicTerm.findMany({
      orderBy: [
        { isCurrent: "desc" },
        { academicYear: "desc" },
        { termName: "asc" },
      ],
    }),
    prisma.departmentSubject.findMany({
      orderBy: [{ department: "asc" }, { category: "asc" }, { name: "asc" }],
    }),
  ]);

  return NextResponse.json({ school, terms, departmentSubjects });
}

export async function PATCH(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = schoolSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid school profile" },
        { status: 400 }
      );
    }

    const updated = await prisma.schoolProfile.upsert({
      where: { id: "default" },
      update: parsed.data,
      create: { id: "default", ...parsed.data },
    });

    return NextResponse.json({ school: updated });
  } catch (err) {
    console.error("Update school profile error:", err);
    return NextResponse.json(
      { error: "Failed to save school profile." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = termSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid academic term" },
        { status: 400 }
      );
    }

    if (parsed.data.isCurrent) {
      await prisma.academicTerm.updateMany({ data: { isCurrent: false } });
    }

    const created = await prisma.academicTerm.create({
      data: {
        academicYear: parsed.data.academicYear.trim(),
        termName: parsed.data.termName,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        nextTermReopeningDate: parsed.data.nextTermReopeningDate || null,
        classScoreWeight: parsed.data.classScoreWeight,
        primaryGradingScale: parsed.data.primaryGradingScale,
        isCurrent: Boolean(parsed.data.isCurrent),
      },
    });

    return NextResponse.json({ term: created }, { status: 201 });
  } catch (err) {
    console.error("Create term error:", err);
    return NextResponse.json(
      { error: "This academic year and term already exists." },
      { status: 409 }
    );
  }
}
