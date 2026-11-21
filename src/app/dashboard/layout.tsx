import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { RealtimeRoot } from "@/components/RealtimeRoot";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [school, currentTerm, crecheCheck] = await Promise.all([
    prisma.schoolProfile.findUnique({ where: { id: "default" } }),
    prisma.academicTerm.findFirst({ where: { isCurrent: true } }),
    user.role === "SUPER_ADMIN"
      ? Promise.resolve(1)
      : user.role === "TEACHER"
        ? prisma.classroom.count({
          where: { teacherId: user.id, department: "CRECHE" },
        })
        : user.role === "PARENT"
          ? prisma.student.count({
            where: { parentId: user.id, classroom: { department: "CRECHE" } },
          })
          : Promise.resolve(0),
  ]);

  const schoolName = school?.schoolName || "Sankofa Preparatory & JHS";
  const currentTermLabel = currentTerm
    ? `${currentTerm.academicYear} • ${currentTerm.termName}`
    : "No Active Term";

  return (
    <RealtimeRoot realtimeUrl={process.env.NEON_REALTIME_URL || null}>
      <DashboardShell
        user={{
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        }}
        schoolName={schoolName}
        currentTermLabel={currentTermLabel}
        hasCrecheAccess={crecheCheck > 0}
      >
        {children}
      </DashboardShell>
    </RealtimeRoot>
  );
}
