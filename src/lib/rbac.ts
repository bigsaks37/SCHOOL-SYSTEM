export type UserRole = "SUPER_ADMIN" | "BURSAR" | "TEACHER" | "PARENT";

export const VALID_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "BURSAR",
  "TEACHER",
  "PARENT",
];

export const ROLE_META: Record<
  UserRole,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    description: string;
  }
> = {
  SUPER_ADMIN: {
    label: "Headmaster (Admin)",
    shortLabel: "Headmaster",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    description:
      "Full administrative control over departments, classes, student & teacher admissions, finances, and RBAC",
  },
  BURSAR: {
    label: "Accountant",
    shortLabel: "Accountant",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    description: "Fee structures, billing, MoMo/cash receipts & arrears",
  },
  TEACHER: {
    label: "Teacher",
    shortLabel: "Teacher",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
    description: "Class rosters, daily attendance & SBA assessments",
  },
  PARENT: {
    label: "Parent",
    shortLabel: "Parent",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
    description: "Ward attendance, report cards, fee ledger & notices",
  },
};

export interface NavItem {
  href: string;
  label: string;
  icon:
    | "LayoutDashboard"
    | "GraduationCap"
    | "Briefcase"
    | "BookOpen"
    | "ClipboardCheck"
    | "Baby"
    | "Award"
    | "FileText"
    | "Wallet"
    | "Megaphone"
    | "MessageSquare"
    | "Users"
    | "Settings";
  roles: UserRole[];
}

export const DASHBOARD_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: "LayoutDashboard",
    roles: ["SUPER_ADMIN", "BURSAR", "TEACHER", "PARENT"],
  },
  {
    href: "/dashboard/students",
    label: "Students",
    icon: "GraduationCap",
    roles: ["SUPER_ADMIN", "BURSAR", "TEACHER", "PARENT"],
  },
  {
    href: "/dashboard/teachers",
    label: "Teachers & Staff",
    icon: "Briefcase",
    roles: ["SUPER_ADMIN"],
  },
  {
    href: "/dashboard/classes",
    label: "Departments & Classes",
    icon: "BookOpen",
    roles: ["SUPER_ADMIN", "TEACHER"],
  },
  {
    href: "/dashboard/attendance",
    label: "Attendance",
    icon: "ClipboardCheck",
    roles: ["SUPER_ADMIN", "TEACHER", "PARENT"],
  },
  {
    href: "/dashboard/creche-care",
    label: "Creche Care Logs",
    icon: "Baby",
    roles: ["SUPER_ADMIN", "TEACHER", "PARENT"],
  },
  {
    href: "/dashboard/assessments",
    label: "Grading & Scores",
    icon: "Award",
    roles: ["SUPER_ADMIN", "TEACHER", "PARENT"],
  },
  {
    href: "/dashboard/report-cards",
    label: "Report Cards",
    icon: "FileText",
    roles: ["SUPER_ADMIN", "TEACHER", "PARENT"],
  },
  {
    href: "/dashboard/finance",
    label: "Fees & Finance",
    icon: "Wallet",
    roles: ["SUPER_ADMIN", "BURSAR", "PARENT"],
  },
  {
    href: "/dashboard/announcements",
    label: "Announcements",
    icon: "Megaphone",
    roles: ["SUPER_ADMIN", "BURSAR", "TEACHER", "PARENT"],
  },
  {
    href: "/dashboard/sms",
    label: "SMS Outbox",
    icon: "MessageSquare",
    roles: ["SUPER_ADMIN"],
  },
  {
    href: "/dashboard/users",
    label: "User Accounts",
    icon: "Users",
    roles: ["SUPER_ADMIN"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: "Settings",
    roles: ["SUPER_ADMIN", "BURSAR", "TEACHER", "PARENT"],
  },
];

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  const item = DASHBOARD_NAV.find(
    (nav) => nav.href !== "/dashboard" && pathname.startsWith(nav.href)
  );
  if (!item) return true;
  return item.roles.includes(role);
}
