"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  Briefcase,
  BookOpen,
  ClipboardCheck,
  Baby,
  Award,
  FileText,
  Wallet,
  Megaphone,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  CalendarDays,
} from "lucide-react";
import { DASHBOARD_NAV, ROLE_META, type NavItem, type UserRole } from "@/lib/rbac";
import { neonAuthClient } from "@/lib/neonAuthClient";

const ICON_MAP: Record<NavItem["icon"], React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  GraduationCap,
  Briefcase,
  BookOpen,
  ClipboardCheck,
  Baby,
  Award,
  FileText,
  Wallet,
  Megaphone,
  MessageSquare,
  Users,
  Settings,
};

interface DashboardShellProps {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  };
  schoolName: string;
  currentTermLabel: string;
  hasCrecheAccess: boolean;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  schoolName,
  currentTermLabel,
  hasCrecheAccess,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const visibleNav = DASHBOARD_NAV.filter((item) => {
    if (!item.roles.includes(user.role)) return false;
    if (item.href === "/dashboard/creche-care" && !hasCrecheAccess) return false;
    return true;
  });
  const roleMeta = ROLE_META[user.role];

  const activeNav =
    visibleNav.find((item) =>
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.href)
    ) || visibleNav[0];

  async function handleSignOut() {
    setSigningOut(true);
    await Promise.allSettled([
      fetch("/api/auth/logout", { method: "POST" }),
      neonAuthClient.signOut(),
    ]);
    router.push("/login");
    router.refresh();
  }

  const initials = user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* School Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="h-9 w-9 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center shrink-0 shadow">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{schoolName}</p>
            <p className="text-[11px] text-emerald-400 font-medium truncate">
              Ghana Basic SMS
            </p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role Context Pill */}
      <div className="px-4 py-3 border-b border-slate-800/80">
        <div className="rounded-xl bg-slate-800/70 p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {initials || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">
              {user.fullName}
            </p>
            <p className="text-[11px] text-amber-300 font-medium truncate">
              {roleMeta.label}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleNav.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          const label =
            user.role === "PARENT" && item.href === "/dashboard/students"
              ? "My Wards"
              : item.label;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign Out Footer */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-red-500/15 hover:text-red-300 transition cursor-pointer disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Fixed Sidebar */}
      <aside className="no-print hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[82vw] h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="print-reset-layout flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top App Bar */}
        <header className="no-print sticky top-0 z-20 h-16 bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-xl p-2 text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {user.role === "PARENT" &&
                activeNav?.href === "/dashboard/students"
                  ? "My Wards"
                  : activeNav?.label || "Dashboard"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-700" />
              {currentTermLabel}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${roleMeta.badgeClass}`}
            >
              {roleMeta.shortLabel}
            </span>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
