import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

let bootstrapPromise: Promise<void> | null = null;
let bootstrapped = false;

/**
 * Automatic First-Run Seeding for Live Cloud Deployments.
 *
 * When deployed to Vercel or Render with a brand-new empty PostgreSQL database,
 * this guarantees the default School Profile, active Academic Term, and
 * Headmaster (Admin) login exist before the very first sign-in attempt —
 * without crashing under concurrent cold starts.
 */
export async function ensureInitialAdminSeeded(): Promise<void> {
  if (bootstrapped) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        bootstrapped = true;
        return;
      }

      const passwordHash = await bcrypt.hash("Password123!", 10);

      await prisma.schoolProfile.upsert({
        where: { id: "default" },
        update: {},
        create: {
          id: "default",
          schoolName: "Sankofa Preparatory & JHS",
          motto: "Excellence, Integrity & Service",
          address: "Plot 14, East Legon, Accra, Ghana",
          phone: "+233 30 255 0148",
          email: "admin@sankofaschool.edu.gh",
          gesCode: "GES-GA-0419",
          currency: "GHS",
        },
      });

      await prisma.academicTerm.upsert({
        where: {
          academicYear_termName: {
            academicYear: "2026/2027",
            termName: "Term 1",
          },
        },
        update: {},
        create: {
          academicYear: "2026/2027",
          termName: "Term 1",
          startDate: "2026-09-08",
          endDate: "2026-12-18",
          nextTermReopeningDate: "2027-01-12",
          classScoreWeight: 50,
          primaryGradingScale: "LETTER",
          isCurrent: true,
        },
      });

      await prisma.user.upsert({
        where: { email: "headmaster@sankofa.edu.gh" },
        update: {},
        create: {
          staffId: "ADM-2026-001",
          fullName: "Mr. Kwame Mensah-Bonsu",
          email: "headmaster@sankofa.edu.gh",
          phone: "+233 24 410 2200",
          qualification: "M.Ed Educational Leadership",
          passwordHash,
          role: "SUPER_ADMIN",
          isActive: true,
        },
      });

      bootstrapped = true;
    } catch (err) {
      // Never crash a request on race condition; allow retry on next request
      console.error("First-run bootstrap warning:", err);
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}
