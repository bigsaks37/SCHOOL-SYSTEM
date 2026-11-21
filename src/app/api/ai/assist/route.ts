import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { draftSchoolContent, getAiGatewayStatus } from "@/lib/neonAi";

const assistSchema = z.object({
  kind: z.enum(["announcement", "report_remark"]),
  prompt: z.string().min(3, "Please provide a brief topic or context."),
  model: z.string().optional(),
});

export async function GET() {
  const { error, status } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
  ]);
  if (error) return NextResponse.json({ error }, { status });

  const gateway = await getAiGatewayStatus();
  return NextResponse.json({ gateway });
}

export async function POST(request: Request) {
  const { error, status } = await requireRole([
    "SUPER_ADMIN",
    "BURSAR",
    "TEACHER",
  ]);
  if (error) return NextResponse.json({ error }, { status });

  try {
    const body = await request.json();
    const parsed = assistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid AI prompt." },
        { status: 400 }
      );
    }

    const result = await draftSchoolContent(parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          unavailableReason: result.unavailableReason ?? null,
          recoveryUrl: result.recoveryUrl ?? null,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      text: result.text,
      model: result.model,
    });
  } catch (err) {
    console.error("AI assist route error:", err);
    return NextResponse.json(
      { error: "Unable to process AI Gateway request." },
      { status: 500 }
    );
  }
}
