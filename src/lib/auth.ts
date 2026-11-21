import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { UserRole } from "./rbac";
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";

export { SESSION_COOKIE_NAME, signSessionToken, verifySessionToken };
export type { SessionPayload };

/**
 * Retrieves and verifies the currently authenticated user directly from SQLite/Prisma.
 * Guarantees revoked or deactivated accounts cannot access protected APIs or pages.
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
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

  if (!user || !user.isActive) return null;

  return {
    ...user,
    role: user.role as UserRole,
  };
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: "Unauthorized. Please sign in.",
      status: 401 as const,
      user: null,
    };
  }
  if (!allowedRoles.includes(user.role)) {
    return {
      error: "Forbidden. You do not have permission for this action.",
      status: 403 as const,
      user: null,
    };
  }
  return { error: null, status: 200 as const, user };
}
