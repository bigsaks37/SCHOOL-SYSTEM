import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedGhanaSchoolDemo } from "@/lib/demoSeeder";

export async function POST() {
  const { error, status } = await requireRole(["SUPER_ADMIN"]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const result = await seedGhanaSchoolDemo(prisma);
    return NextResponse.json({
      success: true,
      message: `Loaded sample Ghanaian school data (${result.departments} departments, ${result.classes} classes, ${result.teachers} teachers, ${result.students} students).`,
      result,
    });
  } catch (err) {
    console.error("Load sample data error:", err);
    return NextResponse.json(
      { error: "Failed to load sample Ghanaian school data." },
      { status: 500 }
    );
  }
}
