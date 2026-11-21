import "server-only";
import { createRealtime, pgParam, rawSql } from "@neon/realtime/server";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/rbac";

export interface LiveAnnouncementRow {
  id: string;
  title: string;
  content: string;
  audience: "ALL" | "TEACHERS" | "PARENTS" | "STAFF";
  targetDepartment: "ALL" | "CRECHE" | "KINDERGARTEN" | "PRIMARY" | "JHS";
  pinned: boolean;
  createdAt: Date;
  authorId: string | null;
  authorFullName: string | null;
  authorRole: string | null;
}

export function getPostgresDbName(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "neondb";
  try {
    const pathname = new URL(raw).pathname.replace(/^\/+/, "");
    return pathname || "neondb";
  } catch {
    return "neondb";
  }
}

export function isRealtimeConfigured(): boolean {
  return Boolean(
    process.env.NEON_REALTIME_SECRET && process.env.NEON_REALTIME_URL
  );
}

export const realtime = createRealtime({
  secret:
    process.env.NEON_REALTIME_SECRET ||
    "placeholder-realtime-secret-for-build-only",
  db: getPostgresDbName(),
  debugMode: process.env.NODE_ENV === "development",
});

export async function getAllowedAnnouncementFilters(user: {
  id: string;
  role: UserRole;
}): Promise<{ audiences: string[]; departments: string[] }> {
  if (user.role === "SUPER_ADMIN") {
    return {
      audiences: ["ALL", "TEACHERS", "PARENTS", "STAFF"],
      departments: ["ALL", "CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"],
    };
  }

  if (user.role === "BURSAR") {
    return {
      audiences: ["ALL", "STAFF"],
      departments: ["ALL", "CRECHE", "KINDERGARTEN", "PRIMARY", "JHS"],
    };
  }

  if (user.role === "TEACHER") {
    const classes = await prisma.classroom.findMany({
      where: { teacherId: user.id },
      select: { department: true },
    });
    const teacherDepts = Array.from(new Set(classes.map((c) => c.department)));
    return {
      audiences: ["ALL", "TEACHERS", "STAFF"],
      departments: ["ALL", ...teacherDepts],
    };
  }

  // PARENT
  const wards = await prisma.student.findMany({
    where: { parentId: user.id, status: "ACTIVE" },
    select: { classroom: { select: { department: true } } },
  });
  const wardDepts = Array.from(
    new Set(wards.map((w) => w.classroom?.department).filter(Boolean))
  ) as string[];
  return {
    audiences: ["ALL", "PARENTS"],
    departments: ["ALL", ...wardDepts],
  };
}

export function liveAnnouncementsQuery(
  audiences: string[],
  departments: string[]
) {
  return rawSql<LiveAnnouncementRow>(
    `SELECT
       a."id" AS "id",
       a."title" AS "title",
       a."content" AS "content",
       a."audience" AS "audience",
       a."targetDepartment" AS "targetDepartment",
       a."pinned" AS "pinned",
       a."createdAt" AS "createdAt",
       a."authorId" AS "authorId",
       u."fullName" AS "authorFullName",
       u."role" AS "authorRole"
     FROM "Announcement" a
     LEFT JOIN "User" u ON u."id" = a."authorId"
     WHERE a."audience" = ANY($1)
       AND a."targetDepartment" = ANY($2)
     ORDER BY a."pinned" DESC, a."createdAt" DESC
     LIMIT 50`,
    [pgParam.array("text", audiences), pgParam.array("text", departments)]
  );
}
