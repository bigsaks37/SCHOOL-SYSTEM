"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  GraduationCap,
  BookOpen,
  Briefcase,
  Wallet,
  ClipboardCheck,
  Megaphone,
  ArrowRight,
  Pin,
  Loader2,
  AlertCircle,
  UserPlus,
  Layers,
  Baby,
  ShieldCheck,
  Utensils,
  MessageSquare,
  Database,
} from "lucide-react";
import {
  ParentPortalDashboard,
  type ParentWardSummary,
} from "@/components/ParentPortalDashboard";
import {
  formatGHS,
  formatDate,
  PAYMENT_METHOD_LABELS,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  FEEDING_STATUS_LABELS,
  MOOD_LABELS,
} from "@/lib/format";
import { ROLE_META, type UserRole } from "@/lib/rbac";

interface SummaryData {
  role: UserRole;
  parentPhone?: string | null;
  currentTerm: { id?: string; academicYear: string; termName: string } | null;
  stats: Record<string, number>;
  teacherInfo?: {
    staffId: string | null;
    qualification: string | null;
    subjects: string[];
    hasCrecheClass: boolean;
  };
  enrollmentByDepartment?: Array<{
    department: "CRECHE" | "KINDERGARTEN" | "PRIMARY" | "JHS";
    students: number;
    classes: number;
  }>;
  attendanceByDepartment?: Array<{
    department: "CRECHE" | "KINDERGARTEN" | "PRIMARY" | "JHS";
    totalStudents: number;
    present: number;
    late: number;
    absent: number;
    marked: number;
    rate: number;
  }>;
  crecheOversight?: {
    date: string;
    totalCrecheStudents: number;
    loggedToday: number;
    pickupVerifiedToday: number;
    refusedMealAlerts: number;
    unwellAlerts: number;
    logs: Array<{
      id: string;
      breakfastStatus: string;
      lunchStatus: string;
      napDuration: string | null;
      mood: string;
      pickupVerified: boolean;
      pickupAuthorizedName: string | null;
      student: { firstName: string; lastName: string; admissionNo: string };
      classroom: { id: string; name: string };
    }>;
  };
  wardSummaries?: ParentWardSummary[];
  classes?: Array<{
    id: string;
    name: string;
    department: string;
    capacity: number;
    teacher?: { fullName: string } | null;
    _count: { students: number };
    todayMarked?: number;
    todayPresent?: number;
    todayRate?: number | null;
    todayCareLogged?: number | null;
  }>;
  recentPayments?: Array<{
    id: string;
    receiptNo: string;
    amountPaid: number;
    paymentMethod: string;
    paidAt: string;
    student: { firstName: string; lastName: string; admissionNo: string };
  }>;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    audience: string;
    pinned: boolean;
    createdAt: string;
    author: { fullName: string; role: string } | null;
  }>;
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const loadSummary = useCallback(() => {
    setLoading(true);
    fetch("/api/dashboard/summary")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError("Failed to load dashboard overview."))
      .finally(() => setLoading(false));
  }, []);

  async function handleQuickLoadSampleData() {
    setSeedingDemo(true);
    try {
      const res = await fetch("/api/admin/seed-demo", { method: "POST" });
      if (res.ok) {
        loadSummary();
      }
    } finally {
      setSeedingDemo(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        <span className="text-sm font-medium">Loading live school data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 flex items-center gap-3 text-red-700">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm font-medium">
          {error || "Unable to load summary."}
        </p>
      </div>
    );
  }

  const {
    role,
    stats,
    announcements,
    enrollmentByDepartment,
    attendanceByDepartment,
    crecheOversight,
    teacherInfo,
  } = data;
  const totalActiveStudents = Math.max(1, stats.activeStudentsCount ?? 1);

  if (role === "PARENT") {
    return (
      <ParentPortalDashboard
        currentTerm={data.currentTerm}
        parentPhone={data.parentPhone}
        stats={stats}
        wards={data.wardSummaries || []}
        announcements={announcements}
        onRefresh={loadSummary}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* First-Run Empty Database Banner for Headmaster */}
      {role === "SUPER_ADMIN" && (stats.activeStudentsCount ?? 0) === 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Fresh Live Database Detected — Ready to Populate!
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Load sample Ghanaian basic school data (4 departments, 14
                classes, teachers, multi-child parents, Creche care logs, BECE
                scores &amp; GH₵ fees) with one click.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleQuickLoadSampleData}
            disabled={seedingDemo}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 shadow-xs cursor-pointer disabled:opacity-60 shrink-0"
          >
            {seedingDemo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            Load Sample Ghanaian School Data
          </button>
        </div>
      )}

      {/* Welcome & Quick Actions Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 text-white p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            {ROLE_META[role].label} Portal
            {teacherInfo?.staffId ? ` • ${teacherInfo.staffId}` : ""}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold mt-1">
            {data.currentTerm
              ? `${data.currentTerm.academicYear} — ${data.currentTerm.termName}`
              : "School Management Overview"}
          </h2>
          <p className="text-sm text-emerald-100 mt-1 max-w-xl">
            {ROLE_META[role].description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {role === "SUPER_ADMIN" && (
            <>
              <Link
                href="/dashboard/students"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-semibold text-xs sm:text-sm px-3.5 py-2 transition"
              >
                <UserPlus className="h-4 w-4" /> Register Student
              </Link>
              <Link
                href="/dashboard/teachers"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm px-3.5 py-2 transition"
              >
                <Briefcase className="h-4 w-4" /> Register Teacher
              </Link>
              <Link
                href="/dashboard/sms"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm px-3.5 py-2 transition"
              >
                <MessageSquare className="h-4 w-4" /> SMS Outbox ({stats.smsCount ?? 0})
              </Link>
            </>
          )}
          {role === "BURSAR" && (
            <>
              <Link
                href="/dashboard/finance?tab=quick-pay"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-semibold text-xs sm:text-sm px-3.5 py-2 transition"
              >
                Quick Payment <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/finance?tab=debtors"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm px-3.5 py-2 transition"
              >
                Debtors List
              </Link>
            </>
          )}
          {role === "TEACHER" && (
            <>
              <Link
                href="/dashboard/attendance"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-semibold text-xs sm:text-sm px-3.5 py-2 transition"
              >
                <ClipboardCheck className="h-4 w-4" /> Mark Attendance
              </Link>
              {teacherInfo?.hasCrecheClass ? (
                <Link
                  href="/dashboard/creche-care"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-semibold text-xs sm:text-sm px-3.5 py-2 transition"
                >
                  <Baby className="h-4 w-4" /> Creche Care Logs
                </Link>
              ) : (
                <Link
                  href="/dashboard/assessments"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm px-3.5 py-2 transition"
                >
                  Enter Scores
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Top Summary Cards */}
      {role === "TEACHER" ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Students in My Classes"
            value={String(stats.activeStudentsCount ?? 0)}
            sub={`Across ${stats.assignedClassesCount ?? 0} assigned class(es)`}
            icon={GraduationCap}
            tone="emerald"
          />
          <StatCard
            label="Today's Attendance"
            value={`${stats.attendanceRateToday ?? 0}%`}
            sub={`${stats.presentToday ?? 0}/${stats.markedToday ?? 0} present today`}
            icon={ClipboardCheck}
            tone="sky"
          />
          <StatCard
            label="Assigned Classes"
            value={String(stats.assignedClassesCount ?? 0)}
            sub="Assigned by Headmaster"
            icon={BookOpen}
            tone="amber"
          />
          {teacherInfo?.hasCrecheClass ? (
            <StatCard
              label="Creche Logs Today"
              value={String(stats.crecheLogsToday ?? 0)}
              sub="Daily toddler care reports"
              icon={Baby}
              tone="violet"
            />
          ) : (
            <StatCard
              label="Assigned Subjects"
              value={String(stats.subjectsCount ?? 0)}
              sub="GES basic subjects"
              icon={Briefcase}
              tone="violet"
            />
          )}
        </div>
      ) : role === "BURSAR" ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Expected Fees"
            value={formatGHS(stats.expectedRevenue ?? 0)}
            sub={`${stats.activeStudentsCount ?? 0} billed students`}
            icon={Wallet}
            tone="sky"
          />
          <StatCard
            label="Total Collected"
            value={formatGHS(stats.collectedRevenue ?? 0)}
            sub={`${
              (stats.expectedRevenue ?? 0) > 0
                ? Math.round(
                    ((stats.collectedRevenue ?? 0) /
                      (stats.expectedRevenue ?? 1)) *
                      100
                  )
                : 0
            }% collection rate`}
            icon={Wallet}
            tone="emerald"
          />
          <StatCard
            label="Total Arrears (Owing)"
            value={formatGHS(stats.outstandingRevenue ?? 0)}
            sub={`${stats.debtorsCount ?? 0} student(s) owing`}
            icon={AlertCircle}
            tone="amber"
          />
          <StatCard
            label="Today's Collections"
            value={formatGHS(stats.todayCollections ?? 0)}
            sub={`${stats.todayReceiptsCount ?? 0} receipt(s) today`}
            icon={Wallet}
            tone="violet"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Students"
            value={String(stats.activeStudentsCount ?? 0)}
            sub="Across 4 departments"
            icon={GraduationCap}
            tone="emerald"
          />
          <StatCard
            label="Total Teachers"
            value={String(stats.totalTeachers ?? 0)}
            sub={`${stats.totalClasses ?? 0} active classes`}
            icon={Briefcase}
            tone="sky"
          />
          <StatCard
            label="Term Fees Collected"
            value={formatGHS(stats.collectedRevenue ?? 0)}
            sub={`Expected ${formatGHS(stats.expectedRevenue ?? 0)}`}
            icon={Wallet}
            tone="emerald"
          />
          <StatCard
            label="Today's Attendance"
            value={`${stats.attendanceRateToday ?? 0}%`}
            sub={`${stats.presentToday ?? 0}/${stats.markedToday ?? 0} marked present`}
            icon={ClipboardCheck}
            tone="amber"
          />
        </div>
      )}

      {/* TEACHER: Assigned Subjects Strip */}
      {role === "TEACHER" && teacherInfo && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-bold text-slate-900">
                My Assigned Subjects
              </h3>
              <p className="text-xs text-slate-500">
                Subjects allocated to you by the Headmaster
                {teacherInfo.qualification
                  ? ` • ${teacherInfo.qualification}`
                  : ""}
              </p>
            </div>
            <Link
              href="/dashboard/assessments"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Record Subject Scores &rarr;
            </Link>
          </div>
          {teacherInfo.subjects.length === 0 ? (
            <p className="text-xs text-slate-500">
              No specific subjects assigned yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {teacherInfo.subjects.map((subj) => (
                <span
                  key={subj}
                  className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-xs font-semibold text-sky-800"
                >
                  {subj}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* HEADMASTER & ACCOUNTANT: Enrollment by Department */}
      {(role === "SUPER_ADMIN" || role === "BURSAR") &&
        enrollmentByDepartment && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-emerald-700" />
                <div>
                  <h3 className="font-bold text-slate-900">
                    Enrollment by Department
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live student &amp; class distribution across Ghana&apos;s
                    four basic school departments.
                  </p>
                </div>
              </div>
              {role === "SUPER_ADMIN" && (
                <Link
                  href="/dashboard/classes"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Manage Departments &amp; Classes &rarr;
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {DEPARTMENTS.map((dept) => {
                const found = enrollmentByDepartment.find(
                  (e) => e.department === dept.key
                );
                const count = found?.students ?? 0;
                const classCount = found?.classes ?? 0;
                const pct = Math.round((count / totalActiveStudents) * 100);

                return (
                  <div
                    key={dept.key}
                    className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${dept.badgeClass}`}
                        >
                          {dept.label}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {dept.range}
                        </p>
                      </div>
                      <span className="text-2xl font-extrabold text-slate-900 leading-none">
                        {count}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>{classCount} class(es)</span>
                        <span className="font-semibold text-slate-700">
                          {pct}% of school
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${dept.barClass}`}
                          style={{
                            width: `${Math.max(count > 0 ? 8 : 0, pct)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* HEADMASTER OVERSIGHT: Live Attendance by Department + Creche Daily Care Oversight */}
      {role === "SUPER_ADMIN" && attendanceByDepartment && crecheOversight && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Attendance Oversight */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-emerald-700" />
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Live Attendance by Department
                    </h3>
                    <p className="text-xs text-slate-500">
                      Today&apos;s roll call ({formatDate(crecheOversight.date)})
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/attendance?tab=history"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Full History &rarr;
                </Link>
              </div>

              <div className="space-y-2.5">
                {DEPARTMENTS.map((dept) => {
                  const row = attendanceByDepartment.find(
                    (a) => a.department === dept.key
                  );
                  return (
                    <div
                      key={dept.key}
                      className="rounded-xl border border-slate-200/80 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {dept.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          Present:{" "}
                          <strong className="text-emerald-700">
                            {row?.present ?? 0}
                          </strong>{" "}
                          &bull; Late:{" "}
                          <strong className="text-amber-600">
                            {row?.late ?? 0}
                          </strong>{" "}
                          &bull; Absent:{" "}
                          <strong className="text-red-600">
                            {row?.absent ?? 0}
                          </strong>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          {row?.marked ? `${row.rate}%` : "Unmarked"}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {row?.marked ?? 0}/{row?.totalStudents ?? 0} marked
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Creche Daily Care Oversight */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Baby className="h-5 w-5 text-pink-600" />
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Creche Daily Care Oversight
                    </h3>
                    <p className="text-xs text-slate-500">
                      Live toddler feeding, nap, health &amp; pickup checks
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/creche-care"
                  className="text-xs font-semibold text-pink-700 hover:underline"
                >
                  Inspect All Logs &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl bg-pink-50 border border-pink-200 p-2.5 text-center">
                  <p className="text-[11px] font-semibold text-pink-700">
                    Logged Today
                  </p>
                  <p className="text-base font-extrabold text-pink-950">
                    {crecheOversight.loggedToday}/
                    {crecheOversight.totalCrecheStudents}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-center">
                  <p className="text-[11px] font-semibold text-emerald-700">
                    Verified Pickups
                  </p>
                  <p className="text-base font-extrabold text-emerald-950">
                    {crecheOversight.pickupVerifiedToday}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-center">
                  <p className="text-[11px] font-semibold text-amber-700">
                    Care Alerts
                  </p>
                  <p className="text-base font-extrabold text-amber-950">
                    {crecheOversight.refusedMealAlerts +
                      crecheOversight.unwellAlerts}
                  </p>
                </div>
              </div>

              {crecheOversight.logs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No Creche Daily Care Reports logged today yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {crecheOversight.logs.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200/80 p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {log.student.firstName} {log.student.lastName}{" "}
                          <span className="font-normal text-slate-500">
                            ({log.classroom.name})
                          </span>
                        </p>
                        <p className="text-slate-600 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Utensils className="h-3 w-3 text-amber-600" />
                            {FEEDING_STATUS_LABELS[log.breakfastStatus]} /{" "}
                            {FEEDING_STATUS_LABELS[log.lunchStatus]}
                          </span>
                          <span>&bull; {MOOD_LABELS[log.mood]}</span>
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                          log.pickupVerified
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {log.pickupVerified ? "Picked Up" : "In Care"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {(role === "SUPER_ADMIN" || role === "BURSAR") &&
            data.recentPayments && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">
                    Recent Fee Receipts
                  </h3>
                  <Link
                    href="/dashboard/finance?tab=receipts"
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Open Finance
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Receipt</th>
                        <th className="px-4 py-3 font-semibold">Student</th>
                        <th className="px-4 py-3 font-semibold">Method</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recentPayments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-4 py-6 text-center text-slate-500"
                          >
                            No fee payments recorded yet.
                          </td>
                        </tr>
                      ) : (
                        data.recentPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-mono text-xs font-semibold">
                              <Link
                                href={`/dashboard/finance/receipts/${p.id}`}
                                className="text-emerald-700 hover:underline"
                              >
                                {p.receiptNo}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">
                                {p.student.firstName} {p.student.lastName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatDate(p.paidAt)}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {PAYMENT_METHOD_LABELS[p.paymentMethod] ||
                                p.paymentMethod}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700">
                              {formatGHS(p.amountPaid)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {role === "TEACHER" && data.classes && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">
                  My Assigned Classes
                </h3>
                <Link
                  href="/dashboard/classes"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  View Classes
                </Link>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.classes.length === 0 ? (
                  <p className="text-sm text-slate-500 col-span-2 py-4 text-center">
                    No classes assigned to you yet. Contact the Headmaster.
                  </p>
                ) : (
                  data.classes.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {DEPARTMENT_LABELS[c.department] || c.department}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                          {c._count.students} student(s)
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center justify-between">
                        <span>Today&apos;s Roll Call:</span>
                        <strong className="text-slate-900">
                          {c.todayRate !== null && c.todayRate !== undefined
                            ? `${c.todayRate}% (${c.todayPresent}/${c.todayMarked})`
                            : "Not marked yet"}
                        </strong>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        <Link
                          href={`/dashboard/attendance?classroomId=${c.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1.5 text-xs font-semibold"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          Attendance
                        </Link>
                        {c.department === "CRECHE" && (
                          <Link
                            href={`/dashboard/creche-care?classroomId=${c.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 px-2.5 py-1.5 text-xs font-semibold"
                          >
                            <Baby className="h-3.5 w-3.5" />
                            Care Logs ({c.todayCareLogged ?? 0})
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notice Board */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-emerald-700" />
              <h3 className="font-bold text-slate-900">Notice Board</h3>
            </div>
            <Link
              href="/dashboard/announcements"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {announcements.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">
                No announcements posted yet.
              </p>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900 leading-snug">
                      {a.title}
                    </p>
                    {a.pinned && (
                      <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 line-clamp-3 leading-relaxed">
                    {a.content}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    {a.author?.fullName || "Administration"} &bull;{" "}
                    {formatDate(a.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber" | "sky" | "violet";
}) {
  const toneClasses = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
  }[tone];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 truncate">{label}</p>
        <div
          className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${toneClasses}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2.5 text-lg sm:text-2xl font-extrabold text-slate-900 truncate">
        {value}
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>
    </div>
  );
}
