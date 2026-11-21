import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "./rbac";

export const SESSION_COOKIE_NAME = "sms_session";

export interface SessionPayload {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
}

function getSecretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    "sankofa-basic-school-ghana-sms-dev-secret-key-2026";
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.fullName === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role as UserRole,
      };
    }
    return null;
  } catch {
    return null;
  }
}
