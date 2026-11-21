"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCheck,
  Save,
  Loader2,
  ClipboardCheck,
  Calendar,
  History,
  Baby,
  ArrowRight,
  Search,
} from "lucide-react";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import { formatDate, DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/format";
import type { UserRole } from "@/lib/rbac";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

interface StudentEntry {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: string;
}

interface ParentAttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
  student: { firstName: string; lastName: string; admissionNo: string };
  classroom: { name: string; department: string };
}

interface DailySummaryRow {
  date: string;
  classroomId: string;
  classroomName: string;
  department: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  rate: number;
}

interface HistoryRecordRow {
  id: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
  };
  classroom: { id: string; name: string; department: string };
  markedBy: { fullName: string } | null;
}

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-600 text-white border-emerald-600",
  LATE: "bg-amber-500 text-white border-amber-500",
  ABSENT: "bg-red-600 text-white border-red-600",
  EXCUSED: "bg-sky-600 text-white border-sky-600",
};

const BADGE_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800",
  LATE: "bg-amber-100 text-amber-800",
  ABSENT: "bg-red-100 text-red-800",
  EXCUSED: "bg-sky-100 text-sky-800",
};

function AttendanceInner() {
  const searchParams = useSearchParams();
  const initialClass = searchParams.get("classroomId") || "";
  const initialTab =
    searchParams.get("tab") === "history" ? "history" : "register";

  const [role, setRole] = useState<UserRole | null>(null);
  const [tab, setTab] = useState<"register" | "history">(initialTab);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [classrooms, setClassrooms] = useState<
    { id: string; name: string; department: string }[]
  >([]);
  const [classroomId, setClassroomId] = useState(initialClass);
  const [activeClass, setActiveClass] = useState<{
    id: string;
    name: string;
    department: string;
  } | null>(null);
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [marks, setMarks] = useState<
    Record<string, { status: AttendanceStatus; remarks: string }>
  >({});
  const [parentRecords, setParentRecords] = useState<ParentAttendanceRecord[]>(
    []
  );

  // History state
  const [historyDept, setHistoryDept] = useState("ALL");
  const [historyClass, setHistoryClass] = useState("ALL");
  const [historyDays, setHistoryDays] = useState("14");
  const [historySearch, setHistorySearch] = useState("");
  const [dailySummaries, setDailySummaries] = useState<DailySummaryRow[]>([]);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecordRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me");
      const meJson = await meRes.json();
      const userRole: UserRole = meJson.user?.role;
      setRole(userRole);

      if (userRole === "PARENT") {
        const res = await fetch("/api/attendance");
        const data = await res.json();
        setParentRecords(data.records || []);
        return;
      }

      if (tab === "history") {
        const params = new URLSearchParams({
          mode: "history",
          days: historyDays,
        });
        if (historyDept !== "ALL") params.set("department", historyDept);
        if (historyClass !== "ALL") params.set("classroomId", historyClass);

        const res = await fetch(`/api/attendance?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setToast({
            type: "error",
            text: data.error || "Failed to load attendance history.",
          });
          return;
        }
        setClassrooms(data.classrooms || []);
        setDailySummaries(data.dailySummaries || []);
        setHistoryRecords(data.historyRecords || []);
      } else {
        const params = new URLSearchParams({ mode: "register", date });
        if (classroomId) params.set("classroomId", classroomId);

        const res = await fetch(`/api/attendance?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setToast({
            type: "error",
            text: data.error || "Failed to load attendance register.",
          });
          return;
        }

        setClassrooms(data.classrooms || []);
        setActiveClass(data.activeClass || null);
        if (data.activeClassId && data.activeClassId !== classroomId) {
          setClassroomId(data.activeClassId);
        }
        const stuList: StudentEntry[] = data.students || [];
        setStudents(stuList);

        const recordMap: Record<
          string,
          { status: AttendanceStatus; remarks: string }
        > = {};
        const existing: Array<{
          studentId: string;
          status: AttendanceStatus;
          remarks: string | null;
        }> = data.records || [];

        for (const s of stuList) {
          const found = existing.find((r) => r.studentId === s.id);
          recordMap[s.id] = {
            status: found?.status || "PRESENT",
            remarks: found?.remarks || "",
          };
        }
        setMarks(recordMap);
      }
    } catch {
      setToast({ type: "error", text: "Network error loading attendance." });
    } finally {
      setLoading(false);
    }
  }, [classroomId, date, historyClass, historyDays, historyDept, tab]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  function markAllPresent() {
    setMarks((prev) => {
      const next = { ...prev };
      for (const s of students) {
        next[s.id] = { status: "PRESENT", remarks: prev[s.id]?.remarks || "" };
      }
      return next;
    });
  }

  async function handleSave() {
    if (!classroomId || students.length === 0) return;
    setSaving(true);
    setToast(null);
    try {
      const entries = students.map((s) => ({
        studentId: s.id,
        status: marks[s.id]?.status || "PRESENT",
        remarks: marks[s.id]?.remarks || "",
      }));

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classroomId, date, entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Failed to save attendance.",
        });
      } else {
        setToast({
          type: "success",
          text: `Saved attendance for ${data.count} student(s) on ${formatDate(date)}.`,
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error saving attendance." });
    } finally {
      setSaving(false);
    }
  }

  // Live register tally
  const registerPresent = students.filter(
    (s) => marks[s.id]?.status === "PRESENT"
  ).length;
  const registerLate = students.filter(
    (s) => marks[s.id]?.status === "LATE"
  ).length;
  const registerAbsent = students.filter(
    (s) => marks[s.id]?.status === "ABSENT"
  ).length;

  if (role === "PARENT") {
    return (
      <div className="space-y-5">
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Ward Attendance Log
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time daily attendance marked by your ward&apos;s class teacher.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-12 flex justify-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
            </div>
          ) : parentRecords.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No attendance records recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Ward</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Teacher Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parentRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {formatDate(r.date)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {r.student.firstName} {r.student.lastName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.classroom.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[r.status]}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {r.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const filteredHistoryRows = historySearch.trim()
    ? historyRecords.filter((r) =>
        `${r.student.firstName} ${r.student.lastName} ${r.student.admissionNo} ${r.classroom.name}`
          .toLowerCase()
          .includes(historySearch.trim().toLowerCase())
      )
    : historyRecords;

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Daily Attendance &amp; History
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Fast mobile-friendly roll call for Present, Absent, and Late status
            plus searchable history across dates.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === "register"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            Mark Register
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === "history"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="h-4 w-4" />
            Attendance History
          </button>
        </div>
      </div>

      {tab === "register" ? (
        <>
          {/* Class & Date Selector + Save Buttons */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Classroom
              </label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({DEPARTMENT_LABELS[c.department] || c.department})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:w-52">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Attendance Date
              </label>
              <div className="relative">
                <Calendar className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={markAllPresent}
                disabled={students.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold px-3.5 py-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4 text-emerald-700" />
                All Present
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || students.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Register
              </button>
            </div>
          </div>

          {/* Exclusive Creche Daily Care Banner when a Creche class is open */}
          {activeClass?.department === "CRECHE" && (
            <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-pink-600 text-white flex items-center justify-center shrink-0">
                  <Baby className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-pink-950">
                    Creche Department Active — {activeClass.name}
                  </p>
                  <p className="text-xs text-pink-800">
                    Record toddler feeding, nap time, diaper/potty checks, and
                    pickup ID verification for {formatDate(date)}.
                  </p>
                </div>
              </div>
              <Link
                href={`/dashboard/creche-care?classroomId=${activeClass.id}&date=${date}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 transition shrink-0"
              >
                Open Daily Care Reports <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* Live Tally Strip */}
          {students.length > 0 && !loading && (
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-center">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase">
                  Present
                </p>
                <p className="text-lg font-extrabold text-emerald-900">
                  {registerPresent}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-center">
                <p className="text-[11px] font-semibold text-amber-700 uppercase">
                  Late
                </p>
                <p className="text-lg font-extrabold text-amber-900">
                  {registerLate}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-center">
                <p className="text-[11px] font-semibold text-red-700 uppercase">
                  Absent
                </p>
                <p className="text-lg font-extrabold text-red-900">
                  {registerAbsent}
                </p>
              </div>
            </div>
          )}

          {/* Checklist */}
          {loading ? (
            <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
              <span className="text-sm">Loading register...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <ClipboardCheck className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                No active students in this class
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {students.map((s) => {
                const current = marks[s.id] || {
                  status: "PRESENT" as AttendanceStatus,
                  remarks: "",
                };
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {s.admissionNo} &bull; {s.gender}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["PRESENT", "LATE", "ABSENT"] as AttendanceStatus[]).map(
                          (st) => {
                            const active = current.status === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  setMarks((prev) => ({
                                    ...prev,
                                    [s.id]: { ...current, status: st },
                                  }))
                                }
                                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                                  active
                                    ? STATUS_STYLES[st]
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                {st}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <input
                        type="text"
                        value={current.remarks}
                        onChange={(e) =>
                          setMarks((prev) => ({
                            ...prev,
                            [s.id]: { ...current, remarks: e.target.value },
                          }))
                        }
                        placeholder="Optional remark..."
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs sm:w-52 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ATTENDANCE HISTORY VIEW */
        <div className="space-y-5">
          {/* History Filters */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {role === "SUPER_ADMIN" && (
              <select
                value={historyDept}
                onChange={(e) => {
                  setHistoryDept(e.target.value);
                  setHistoryClass("ALL");
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
            <select
              value={historyClass}
              onChange={(e) => setHistoryClass(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="ALL">All Accessible Classes</option>
              {classrooms
                .filter(
                  (c) => historyDept === "ALL" || c.department === historyDept
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <select
              value={historyDays}
              onChange={(e) => setHistoryDays(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="0">All History</option>
            </select>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Filter student name..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
              <span className="text-sm">Loading attendance history...</span>
            </div>
          ) : (
            <>
              {/* Daily Roll-Call Summary Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Daily Class Roll-Call Summaries
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Class</th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Present
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Late
                        </th>
                        <th className="px-4 py-3 font-semibold text-center">
                          Absent
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailySummaries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            No attendance history found for this period.
                          </td>
                        </tr>
                      ) : (
                        dailySummaries.map((row) => (
                          <tr
                            key={`${row.date}-${row.classroomId}`}
                            className="hover:bg-slate-50/70"
                          >
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {formatDate(row.date)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-900">
                                {row.classroomName}
                              </span>
                              <span className="block text-[11px] text-slate-500">
                                {DEPARTMENT_LABELS[row.department] ||
                                  row.department}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-emerald-700">
                              {row.present}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-amber-600">
                              {row.late}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-red-600">
                              {row.absent + row.excused}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                                {row.rate}%
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Student Attendance Records */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Individual Student Attendance Log (
                    {filteredHistoryRows.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Student</th>
                        <th className="px-4 py-3 font-semibold">Class</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistoryRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            No matching attendance records.
                          </td>
                        </tr>
                      ) : (
                        filteredHistoryRows.slice(0, 60).map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-xs font-medium text-slate-700">
                              {formatDate(r.date)}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">
                                {r.student.firstName} {r.student.lastName}
                              </p>
                              <p className="text-[11px] font-mono text-slate-500">
                                {r.student.admissionNo}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {r.classroom.name}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${BADGE_STYLES[r.status]}`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {r.remarks || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 flex items-center justify-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        </div>
      }
    >
      <AttendanceInner />
    </Suspense>
  );
}
