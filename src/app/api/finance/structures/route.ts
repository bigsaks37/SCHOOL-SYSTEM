import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const structureSchema = z.object({
  title: z.string().min(2, "Fee item title is required"),
  category: z
    .enum(["TUITION", "FEEDING", "TRANSPORT", "PTA", "BOOKS", "OTHER"])
    .default("TUITION"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  department: z.enum(["ALL", "CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"]),
  classroomId: z.string().optional().nullable(),
  termId: z.string().optional(),
});

export async function GET(request: Request) {
  const { error, status } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "PARENT",
  ]);
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const requestedTermId = searchParams.get("termId");

  const [terms, classrooms] = await Promise.all([
    prisma.academicTerm.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
    prisma.classroom.findMany({
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select: { id: true, name: true, department: true },
    }),
  ]);

  const activeTerm =
    terms.find((t) => t.id === requestedTermId) ||
    terms.find((t) => t.isCurrent) ||
    terms[0];

  if (!activeTerm) {
    return NextResponse.json({
      terms: [],
      activeTermId: "",
      classrooms,
      structures: [],
    });
  }

  const structures = await prisma.feeStructure.findMany({
    where: { termId: activeTerm.id },
    orderBy: [{ department: "asc" }, { category: "asc" }, { createdAt: "asc" }],
    include: {
      classroom: { select: { id: true, name: true, department: true } },
    },
  });

  return NextResponse.json({
    terms,
    activeTermId: activeTerm.id,
    classrooms,
    structures,
  });
}

export async function POST(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN", "BURSAR"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = structureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid fee structure" },
        { status: 400 }
      );
    }

    let termId = parsed.data.termId;
    if (!termId) {
      const current = await prisma.academicTerm.findFirst({
        where: { isCurrent: true },
      });
      if (!current) {
        return NextResponse.json(
          { error: "No active academic term found." },
          { status: 400 }
        );
      }
      termId = current.id;
    }

    let department = parsed.data.department;
    const classroomId = parsed.data.classroomId || null;
    if (classroomId) {
      const cls = await prisma.classroom.findUnique({
        where: { id: classroomId },
        select: { department: true },
      });
      if (cls) department = cls.department as typeof department;
    }

    const created = await prisma.feeStructure.create({
      data: {
        title: parsed.data.title.trim(),
        category: parsed.data.category,
        amount: parsed.data.amount,
        department,
        classroomId,
        termId,
      },
      include: {
        classroom: { select: { id: true, name: true, department: true } },
      },
    });

    return NextResponse.json({ structure: created }, { status: 201 });
  } catch (err) {
    console.error("Create fee structure error:", err);
    return NextResponse.json(
      { error: "Failed to add fee item." },
      { status: 500 }
    );
  }
}
