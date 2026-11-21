import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSubjectSchema = z.object({
  name: z.string().min(2, "Subject or learning area name is required").max(100),
  department: z.enum(["CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"]),
  category: z.enum(["CORE", "ELECTIVE", "LEARNING_AREA"]).default("CORE"),
});

export async function GET(request: Request) {
  const { error, status } = await requireRole([
    "SUPER_ADMIN",
    "TEACHER",
    "PARENT",
  ]);
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const department = searchParams.get("department");

  const subjects = await prisma.departmentSubject.findMany({
    where: department && department !== "ALL" ? { department } : undefined,
    orderBy: [{ department: "asc" }, { category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ subjects });
}

export async function POST(request: Request) {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = createSubjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid subject input" },
        { status: 400 }
      );
    }

    const category =
      parsed.data.department === "KINDERGARTEN" ||
      parsed.data.department === "CRECHE"
        ? "LEARNING_AREA"
        : parsed.data.category;

    const created = await prisma.departmentSubject.create({
      data: {
        name: parsed.data.name.trim(),
        department: parsed.data.department,
        category,
      },
    });

    return NextResponse.json({ subject: created }, { status: 201 });
  } catch (err) {
    console.error("Create department subject error:", err);
    return NextResponse.json(
      { error: "This subject already exists in the selected department." },
      { status: 409 }
    );
  }
}
