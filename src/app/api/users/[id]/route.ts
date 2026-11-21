import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(["SUPER_ADMIN", "BURSAR", "TEACHER", "PARENT"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status, user: currentUser } = await requireRole(["SUPER_ADMIN"]);
  if (error || !currentUser) return NextResponse.json({ error }, { status });

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    if (id === currentUser.id && parsed.data.isActive === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own Super Admin account." },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.fullName !== undefined) updateData.fullName = parsed.data.fullName.trim();
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email.trim().toLowerCase();
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone?.trim() || null;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.password && parsed.data.password.length >= 6) {
      updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    console.error("Update user error:", err);
    return NextResponse.json(
      { error: "Failed to update user. Email may already be in use." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error, status, user: currentUser } = await requireRole(["SUPER_ADMIN"]);
  if (error || !currentUser) return NextResponse.json({ error }, { status });

  const { id } = await context.params;
  if (id === currentUser.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return NextResponse.json(
      { error: "Failed to delete user." },
      { status: 500 }
    );
  }
}
