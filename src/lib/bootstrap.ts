import { prisma } from "./prisma";
import { seedGhanaSchoolDemo } from "./demoSeeder";

let bootstrapPromise: Promise<void> | null = null;
let bootstrapped = false;

/**
 * Idempotent PostgreSQL DDL matching `prisma/schema.prisma`.
 * Allows the app to self-initialize tables on a brand-new cloud Postgres DB
 * even if `prisma db push` has not been run yet.
 */
const SCHEMA_DDL_STATEMENTS: string[] = [
  `CREATE SCHEMA IF NOT EXISTS "public"`,

  `CREATE TABLE IF NOT EXISTS "SchoolProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "schoolName" TEXT NOT NULL DEFAULT 'Sankofa Preparatory & JHS',
    "motto" TEXT NOT NULL DEFAULT 'Excellence, Integrity & Service',
    "address" TEXT NOT NULL DEFAULT 'East Legon, Accra, Ghana',
    "phone" TEXT NOT NULL DEFAULT '+233 30 255 0148',
    "email" TEXT NOT NULL DEFAULT 'info@sankofaschool.edu.gh',
    "gesCode" TEXT NOT NULL DEFAULT 'GES-GA-0419',
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolProfile_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "staffId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "qualification" TEXT,
    "subjects" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PARENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "AcademicTerm" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "termName" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "nextTermReopeningDate" TEXT,
    "classScoreWeight" INTEGER NOT NULL DEFAULT 50,
    "primaryGradingScale" TEXT NOT NULL DEFAULT 'LETTER',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "DepartmentSubject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CORE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepartmentSubject_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Classroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'PRIMARY',
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "nhisNumber" TEXT,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "guardianNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "classroomId" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "FeeStructure" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'TUITION',
    "amount" DOUBLE PRECISION NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'ALL',
    "classroomId" TEXT,
    "termId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "FeePayment" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'MOMO',
    "momoNetwork" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'DESK',
    "feeItemLabel" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Assessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "subjectCategory" TEXT NOT NULL DEFAULT 'CORE',
    "classScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "examScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grade" TEXT NOT NULL DEFAULT '1',
    "masteryRating" TEXT,
    "remarks" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "TermReportCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "teacherRemarks" TEXT,
    "conduct" TEXT,
    "interest" TEXT,
    "headmasterRemarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TermReportCard_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "targetDepartment" TEXT NOT NULL DEFAULT 'ALL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "SmsLog" (
    "id" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientPhone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'MANUAL',
    "provider" TEXT NOT NULL DEFAULT 'SIMULATION',
    "status" TEXT NOT NULL DEFAULT 'SIMULATED',
    "providerRef" TEXT,
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE TABLE IF NOT EXISTS "CrecheCareLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "breakfastStatus" TEXT NOT NULL DEFAULT 'ATE_ALL',
    "lunchStatus" TEXT NOT NULL DEFAULT 'ATE_ALL',
    "feedingNotes" TEXT,
    "napDuration" TEXT,
    "sleepQuality" TEXT NOT NULL DEFAULT 'PEACEFUL',
    "diaperChecks" INTEGER NOT NULL DEFAULT 2,
    "pottyNotes" TEXT,
    "temperature" TEXT,
    "mood" TEXT NOT NULL DEFAULT 'HAPPY',
    "healthNotes" TEXT,
    "pickupAuthorizedName" TEXT,
    "pickupIdType" TEXT,
    "pickupIdNumber" TEXT,
    "pickupTime" TEXT,
    "pickupVerified" BOOLEAN NOT NULL DEFAULT false,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrecheCareLog_pkey" PRIMARY KEY ("id")
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "User_staffId_key" ON "User"("staffId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AcademicTerm_academicYear_termName_key" ON "AcademicTerm"("academicYear", "termName")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentSubject_department_name_key" ON "DepartmentSubject"("department", "name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_name_key" ON "Classroom"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Student_admissionNo_key" ON "Student"("admissionNo")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FeePayment_receiptNo_key" ON "FeePayment"("receiptNo")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_studentId_date_key" ON "AttendanceRecord"("studentId", "date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_studentId_termId_subject_key" ON "Assessment"("studentId", "termId", "subject")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "TermReportCard_studentId_termId_key" ON "TermReportCard"("studentId", "termId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "CrecheCareLog_studentId_date_key" ON "CrecheCareLog"("studentId", "date")`,

  `DO $$ BEGIN ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Student" ADD CONSTRAINT "Student_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Student" ADD CONSTRAINT "Student_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TermReportCard" ADD CONSTRAINT "TermReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TermReportCard" ADD CONSTRAINT "TermReportCard_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "TermReportCard" ADD CONSTRAINT "TermReportCard_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "CrecheCareLog" ADD CONSTRAINT "CrecheCareLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "CrecheCareLog" ADD CONSTRAINT "CrecheCareLog_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "CrecheCareLog" ADD CONSTRAINT "CrecheCareLog_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "P2021" || e.code === "P2022" || e.code === "42P01") {
    return true;
  }
  const msg = String(e.message || "");
  return (
    msg.includes("does not exist in the current database") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

export async function ensureDatabaseSchemaSynced(): Promise<void> {
  console.log("[bootstrap] Syncing PostgreSQL schema tables & indexes...");
  for (const sql of SCHEMA_DDL_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("[bootstrap] PostgreSQL schema verified.");
}

/**
 * Formats any Prisma / PostgreSQL error into a clear, actionable API error
 * message and appropriate HTTP status code for login & bootstrap diagnostics.
 */
export function formatDatabaseError(err: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const e = (err && typeof err === "object" ? err : {}) as {
    code?: string;
    name?: string;
    message?: string;
    meta?: unknown;
  };

  const code = e.code || e.name || "UNKNOWN_ERROR";
  const rawMessage = String(e.message || err || "Unknown server error")
    .replace(/\s+/g, " ")
    .trim();
  const shortDetail =
    rawMessage.length > 260 ? `${rawMessage.slice(0, 260)}...` : rawMessage;

  if (code === "MISSING_DATABASE_URL") {
    return {
      status: 503,
      code,
      message:
        "Database is not configured: DATABASE_URL environment variable is missing on the server.",
    };
  }

  if (
    code === "P1001" ||
    code === "P1002" ||
    code === "P1017" ||
    rawMessage.includes("Can't reach database server") ||
    rawMessage.includes("ECONNREFUSED") ||
    rawMessage.includes("ENOTFOUND") ||
    rawMessage.includes("ETIMEDOUT")
  ) {
    return {
      status: 503,
      code,
      message: `Database unreachable (${code}): Could not connect to PostgreSQL. Verify DATABASE_URL and that your database is running. Detail: ${shortDetail}`,
    };
  }

  if (
    code === "P1000" ||
    code === "28P01" ||
    rawMessage.includes("Authentication failed")
  ) {
    return {
      status: 503,
      code,
      message: `Database authentication failed (${code}): Check the credentials in DATABASE_URL. Detail: ${shortDetail}`,
    };
  }

  if (isMissingTableError(err)) {
    return {
      status: 500,
      code,
      message: `Database tables are not initialized (${code}): ${shortDetail}`,
    };
  }

  return {
    status: 500,
    code,
    message: `Login backend error (${code}): ${shortDetail}`,
  };
}

/**
 * Automatic First-Run Schema Sync & Seeding for Live Cloud Deployments.
 *
 * - If tables have not been pushed yet (P2021 / 42P01), creates them idempotently.
 * - If the User table is empty, seeds default accounts (headmaster@sankofa.edu.gh
 *   with password Password123!, Bursar, Teachers, Parents) plus the full Ghanaian
 *   sample school dataset via `seedGhanaSchoolDemo(prisma)`.
 * - Uses a single-flight promise lock so concurrent requests never race.
 * - Propagates real connection/auth errors so callers can log & report them clearly.
 */
export async function ensureInitialAdminSeeded(): Promise<void> {
  if (bootstrapped) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      if (!process.env.DATABASE_URL) {
        const missingErr = new Error(
          "DATABASE_URL environment variable is not set."
        ) as Error & { code?: string };
        missingErr.code = "MISSING_DATABASE_URL";
        throw missingErr;
      }

      let userCount: number;
      try {
        userCount = await prisma.user.count();
      } catch (countErr) {
        if (isMissingTableError(countErr)) {
          console.warn(
            "[bootstrap] Database tables not found — auto-initializing schema now."
          );
          await ensureDatabaseSchemaSynced();
          userCount = await prisma.user.count();
        } else {
          throw countErr;
        }
      }

      if (userCount === 0) {
        console.log(
          "[bootstrap] Users table is empty — seeding default accounts and Ghanaian sample school data..."
        );
        const result = await seedGhanaSchoolDemo(prisma);
        console.log(
          `[bootstrap] Auto-seed complete (${result.departments} departments, ${result.classes} classes, ${result.teachers} teachers, ${result.students} students).`
        );
      }

      bootstrapped = true;
    } catch (err) {
      console.error("[bootstrap] Database auto-initialization failed:", err);
      throw err;
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

export const ensureDatabaseReady = ensureInitialAdminSeeded;
