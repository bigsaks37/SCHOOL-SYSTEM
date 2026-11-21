"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Baby,
  Utensils,
  Moon,
  HeartPulse,
  ShieldCheck,
  Calendar,
  Loader2,
  ClipboardList,
  History,
  CheckCircle2,
  Clock,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import {
  formatDate,
  FEEDING_STATUS_LABELS,
  SLEEP_QUALITY_LABELS,
  MOOD_LABELS,
} from "@/lib/format";
import type { UserRole } from "@/lib/rbac";

type FeedingStatus = "ATE_ALL" | "ATE_HALF" | "REFUSED" | "NOT_APPLICABLE";
type SleepQuality = "PEACEFUL" | "LIGHT" | "RESTLESS" | "NO_NAP";
type MoodType = "HAPPY" | "CALM" | "TIRED" | "FUSSY" | "UNWELL";

interface CrecheClass {
  id: string;
  name: string;
  department: string;
  teacher?: { fullName: string } | null;
  _count?: { students: number };
}

interface CrecheStudent {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  guardianName: string | null;
  guardianPhone: string | null;
  parent: { fullName: string; phone: string | null } | null;
}

interface CareLogRecord {
  id: string;
  studentId: string;
  classroomId: string;
  date: string;
  breakfastStatus: FeedingStatus;
  lunchStatus: FeedingStatus;
  feedingNotes: string | null;
  napDuration: string | null;
  sleepQuality: SleepQuality;
  diaperChecks: number;
  pottyNotes: string | null;
  temperature: string | null;
  mood: MoodType;
  healthNotes: string | null;
  pickupAuthorizedName: string | null;
  pickupIdType: string | null;
  pickupIdNumber: string | null;
  pickupTime: string | null;
  pickupVerified: boolean;
  recordedBy?: { fullName: string } | null;
  student?: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
  };
  classroom?: { id: string; name: string };
}

const defaultCareForm = {
  breakfastStatus: "ATE_ALL" as FeedingStatus,
  lunchStatus: "ATE_ALL" as FeedingStatus,
  feedingNotes: "",
  napDuration: "1 hr 30 mins",
  sleepQuality: "PEACEFUL" as SleepQuality,
  diaperChecks: 3,
  pottyNotes: "",
  temperature: "36.6 °C",
  mood: "HAPPY" as MoodType,
  healthNotes: "",
  pickupAuthorizedName: "",
  pickupIdType: "Ghana Card",
  pickupIdNumber: "",
  pickupTime: "",
  pickupVerified: false,
};

function CrecheCareInner() {
  const searchParams = useSearchParams();
  const initialClass = searchParams.get("classroomId") || "";
  const initialDate =
    searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const [role, setRole] = useState<UserRole | null>(null);
  const [tab, setTab] = useState<"daily" | "history">("daily");
  const [date, setDate] = useState(initialDate);
  const [classrooms, setClassrooms] = useState<CrecheClass[]>([]);
  const [classroomId, setClassroomId] = useState(initialClass);
  const [historyClassFilter, setHistoryClassFilter] = useState("ALL");
  const [students, setStudents] = useState<CrecheStudent[]>([]);
  const [logs, setLogs] = useState<CareLogRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<CareLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<CrecheStudent | null>(null);
  const [form, setForm] = useState(defaultCareForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "history") {
        params.set("mode", "history");
        if (historyClassFilter !== "ALL") {
          params.set("classroomId", historyClassFilter);
        }
      } else {
        params.set("mode", "daily");
        params.set("date", date);
        if (classroomId) params.set("classroomId", classroomId);
      }

      const res = await fetch(`/api/creche-care?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Failed to load Creche Care Logs.",
        });
        return;
      }

      setRole(data.role);
      if (data.role === "PARENT") {
        setHistoryLogs(data.logs || []);
      } else if (tab === "history") {
        setClassrooms(data.classrooms || []);
        setHistoryLogs(data.historyLogs || []);
      } else {
        setClassrooms(data.classrooms || []);
        if (data.activeClassId && data.activeClassId !== classroomId) {
          setClassroomId(data.activeClassId);
        }
        setStudents(data.students || []);
        setLogs(data.logs || []);
      }
    } catch {
      setToast({
        type: "error",
        text: "Network error loading Creche Care Logs.",
      });
    } finally {
      setLoading(false);
    }
  }, [classroomId, date, historyClassFilter, tab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openReportModal(student: CrecheStudent, existing?: CareLogRecord) {
    setActiveStudent(student);
    if (existing) {
      setForm({
        breakfastStatus: existing.breakfastStatus,
        lunchStatus: existing.lunchStatus,
        feedingNotes: existing.feedingNotes || "",
        napDuration: existing.napDuration || "",
        sleepQuality: existing.sleepQuality,
        diaperChecks: existing.diaperChecks,
        pottyNotes: existing.pottyNotes || "",
        temperature: existing.temperature || "",
        mood: existing.mood,
        healthNotes: existing.healthNotes || "",
        pickupAuthorizedName: existing.pickupAuthorizedName || "",
        pickupIdType: existing.pickupIdType || "Ghana Card",
        pickupIdNumber: existing.pickupIdNumber || "",
        pickupTime: existing.pickupTime || "",
        pickupVerified: existing.pickupVerified,
      });
    } else {
      setForm({
        ...defaultCareForm,
        pickupAuthorizedName:
          student.guardianName || student.parent?.fullName || "",
      });
    }
    setModalOpen(true);
  }

  async function handleSaveReport(e: React.FormEvent) {
    e.preventDefault();
    if (!activeStudent || !classroomId) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/creche-care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: activeStudent.id,
          classroomId,
          date,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Failed to save care report.",
        });
      } else {
        setModalOpen(false);
        setToast({
          type: "success",
          text: `Saved Daily Care Report for ${activeStudent.firstName} ${activeStudent.lastName}.`,
        });
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLog(logId: string, childName: string) {
    if (!confirm(`Delete Daily Care Report for ${childName}?`)) return;
    const res = await fetch(`/api/creche-care/${logId}`, { method: "DELETE" });
    if (res.ok) {
      setToast({ type: "success", text: `Deleted care log for ${childName}.` });
      await loadData();
    } else {
      const data = await res.json();
      setToast({ type: "error", text: data.error || "Delete failed." });
    }
  }

  const canEdit = role === "SUPER_ADMIN" || role === "TEACHER";

  if (role === "PARENT") {
    return (
      <div className="space-y-5">
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Creche Daily Care Reports
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Daily feeding, nap time, health &amp; hygiene, and pickup
            verification updates for your Creche ward.
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          </div>
        ) : historyLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <Baby className="h-10 w-10 text-pink-300 mx-auto" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              No Creche Daily Care Reports available yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {historyLogs.map((log) => (
              <CareHistoryCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 border border-pink-200 px-2.5 py-0.5 text-[11px] font-bold text-pink-700 mb-1">
            <Baby className="h-3.5 w-3.5" /> Exclusive to Creche / Daycare Department
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Creche Daily Care Logs
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Record toddler feeding, nap time, diaper/potty &amp; health checks,
            and authorized pickup verification.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTab("daily")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === "daily"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Daily Reports
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
            Care History
          </button>
        </div>
      </div>

      {/* Filters */}
      {classrooms.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col sm:flex-row gap-3">
          {tab === "daily" ? (
            <>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Creche Classroom
                </label>
                <select
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c._count?.students ?? 0} toddlers)
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:w-56">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Report Date
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
            </>
          ) : (
            <div className="sm:w-72">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Filter History by Creche Class
              </label>
              <select
                value={historyClassFilter}
                onChange={(e) => setHistoryClassFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="ALL">All Creche Classes</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <span className="text-sm">Loading Creche care records...</span>
        </div>
      ) : classrooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Baby className="h-10 w-10 text-pink-300 mx-auto" />
          <p className="mt-3 text-sm font-bold text-slate-800">
            No Creche / Daycare Classes Assigned
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Daily Care Reports are exclusive to teachers assigned to the Creche /
            Daycare department (Creche, Nursery 1, Nursery 2) and the Headmaster.
          </p>
        </div>
      ) : tab === "history" ? (
        historyLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            No Creche Daily Care Logs recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {historyLogs.map((log) => (
              <CareHistoryCard
                key={log.id}
                log={log}
                onDelete={
                  canEdit
                    ? () =>
                        handleDeleteLog(
                          log.id,
                          `${log.student?.firstName || ""} ${log.student?.lastName || ""}`
                        )
                    : undefined
                }
              />
            ))}
          </div>
        )
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          No active toddlers enrolled in this Creche class yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {students.map((student) => {
            const log = logs.find((l) => l.studentId === student.id);
            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-base">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {student.admissionNo} &bull; Guardian:{" "}
                        {student.guardianName ||
                          student.parent?.fullName ||
                          "—"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        log
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {log ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Logged
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" /> Pending
                        </>
                      )}
                    </span>
                  </div>

                  {log ? (
                    <div className="grid grid-cols-2 gap-2.5 text-xs pt-2 border-t border-slate-100">
                      <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-2.5">
                        <p className="font-bold text-amber-900 flex items-center gap-1">
                          <Utensils className="h-3.5 w-3.5" /> Feeding
                        </p>
                        <p className="text-slate-700 mt-1">
                          Breakfast:{" "}
                          <strong>
                            {FEEDING_STATUS_LABELS[log.breakfastStatus]}
                          </strong>
                        </p>
                        <p className="text-slate-700">
                          Lunch:{" "}
                          <strong>
                            {FEEDING_STATUS_LABELS[log.lunchStatus]}
                          </strong>
                        </p>
                      </div>

                      <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-2.5">
                        <p className="font-bold text-sky-900 flex items-center gap-1">
                          <Moon className="h-3.5 w-3.5" /> Nap Time
                        </p>
                        <p className="text-slate-700 mt-1">
                          Duration: <strong>{log.napDuration || "—"}</strong>
                        </p>
                        <p className="text-slate-700">
                          Quality:{" "}
                          <strong>
                            {SLEEP_QUALITY_LABELS[log.sleepQuality]}
                          </strong>
                        </p>
                      </div>

                      <div className="rounded-xl bg-pink-50/70 border border-pink-100 p-2.5">
                        <p className="font-bold text-pink-900 flex items-center gap-1">
                          <HeartPulse className="h-3.5 w-3.5" /> Health &amp;
                          Hygiene
                        </p>
                        <p className="text-slate-700 mt-1">
                          Diaper/Potty: <strong>{log.diaperChecks}x</strong>{" "}
                          &bull; {log.temperature || "N/A"}
                        </p>
                        <p className="text-slate-700">
                          Mood: <strong>{MOOD_LABELS[log.mood]}</strong>
                        </p>
                      </div>

                      <div
                        className={`rounded-xl border p-2.5 ${
                          log.pickupVerified
                            ? "bg-emerald-50/70 border-emerald-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <p className="font-bold text-slate-900 flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />{" "}
                          Pickup
                        </p>
                        <p className="text-slate-700 mt-1 truncate">
                          {log.pickupAuthorizedName || "Not set"}
                        </p>
                        <p className="font-semibold mt-0.5 text-[11px] text-emerald-700">
                          {log.pickupVerified
                            ? `Verified ${log.pickupTime ? `@ ${log.pickupTime}` : ""}`
                            : "Awaiting Pickup"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                      No Daily Care Report submitted yet for {formatDate(date)}.
                    </p>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openReportModal(student, log)}
                      className="flex-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold py-2 px-3 transition cursor-pointer"
                    >
                      {log ? "Edit Daily Care Report" : "Fill Daily Care Report"}
                    </button>
                    {log && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteLog(
                            log.id,
                            `${student.firstName} ${student.lastName}`
                          )
                        }
                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        title="Delete report"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Daily Care Report Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          activeStudent
            ? `Daily Care Report — ${activeStudent.firstName} ${activeStudent.lastName}`
            : "Daily Care Report"
        }
        subtitle={`Date: ${formatDate(date)} • Saved directly to database`}
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSaveReport} className="space-y-5">
          {/* Section 1: Feeding */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Utensils className="h-4 w-4" /> 1. Feeding (Breakfast &amp; Lunch)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Breakfast Status
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["ATE_ALL", "ATE_HALF", "REFUSED"] as FeedingStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, breakfastStatus: st })
                        }
                        className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer transition ${
                          form.breakfastStatus === st
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {FEEDING_STATUS_LABELS[st]}
                      </button>
                    )
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Lunch Status
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["ATE_ALL", "ATE_HALF", "REFUSED"] as FeedingStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setForm({ ...form, lunchStatus: st })}
                        className={`rounded-lg border py-1.5 text-xs font-semibold cursor-pointer transition ${
                          form.lunchStatus === st
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {FEEDING_STATUS_LABELS[st]}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Feeding Notes
              </label>
              <input
                value={form.feedingNotes}
                onChange={(e) =>
                  setForm({ ...form, feedingNotes: e.target.value })
                }
                placeholder="e.g. Finished koko & fruit snack; drank plenty of water"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 2: Nap Time */}
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
              <Moon className="h-4 w-4" /> 2. Nap Time
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nap Duration
                </label>
                <input
                  value={form.napDuration}
                  onChange={(e) =>
                    setForm({ ...form, napDuration: e.target.value })
                  }
                  placeholder="e.g. 1 hr 30 mins (12:30 - 2:00 PM)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sleep Quality
                </label>
                <select
                  value={form.sleepQuality}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sleepQuality: e.target.value as SleepQuality,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="PEACEFUL">Peaceful</option>
                  <option value="LIGHT">Light Sleep</option>
                  <option value="RESTLESS">Restless</option>
                  <option value="NO_NAP">Did Not Nap</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Health & Hygiene */}
          <div className="rounded-xl border border-pink-200/80 bg-pink-50/40 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-pink-900 flex items-center gap-1.5">
              <HeartPulse className="h-4 w-4" /> 3. Health &amp; Hygiene
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Diaper / Potty Checks
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={form.diaperChecks}
                  onChange={(e) =>
                    setForm({ ...form, diaperChecks: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Temperature
                </label>
                <input
                  value={form.temperature}
                  onChange={(e) =>
                    setForm({ ...form, temperature: e.target.value })
                  }
                  placeholder="36.6 °C"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Child&apos;s Mood
                </label>
                <select
                  value={form.mood}
                  onChange={(e) =>
                    setForm({ ...form, mood: e.target.value as MoodType })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="HAPPY">Happy &amp; Active</option>
                  <option value="CALM">Calm</option>
                  <option value="TIRED">Tired</option>
                  <option value="FUSSY">Fussy</option>
                  <option value="UNWELL">Unwell / Needs Attention</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Diaper / Potty Notes
                </label>
                <input
                  value={form.pottyNotes}
                  onChange={(e) =>
                    setForm({ ...form, pottyNotes: e.target.value })
                  }
                  placeholder="e.g. 2 wet, 1 clean check"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Health / Mood Notes
                </label>
                <input
                  value={form.healthNotes}
                  onChange={(e) =>
                    setForm({ ...form, healthNotes: e.target.value })
                  }
                  placeholder="e.g. Cheerful during playtime, no fever"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Pickup Verification */}
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> 4. Pickup Verification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Authorized Person Picking Up
                </label>
                <input
                  value={form.pickupAuthorizedName}
                  onChange={(e) =>
                    setForm({ ...form, pickupAuthorizedName: e.target.value })
                  }
                  placeholder="e.g. Mrs. Grace Boadu (Mother)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ID Type Checked
                </label>
                <select
                  value={form.pickupIdType}
                  onChange={(e) =>
                    setForm({ ...form, pickupIdType: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                >
                  <option value="Ghana Card">Ghana Card</option>
                  <option value="School Pickup Tag">School Pickup Tag</option>
                  <option value="Driver's License">Driver&apos;s License</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ID / Pickup Tag Number
                </label>
                <input
                  value={form.pickupIdNumber}
                  onChange={(e) =>
                    setForm({ ...form, pickupIdNumber: e.target.value })
                  }
                  placeholder="e.g. GHA-724819203-4"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pickup Time
                </label>
                <input
                  type="time"
                  value={form.pickupTime}
                  onChange={(e) =>
                    setForm({ ...form, pickupTime: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 pt-1 text-sm font-semibold text-emerald-950 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pickupVerified}
                onChange={(e) =>
                  setForm({ ...form, pickupVerified: e.target.checked })
                }
                className="h-4 w-4 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
              />
              ID verified &amp; child safely handed over to authorized person
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Daily Care Report
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function CareHistoryCard({
  log,
  onDelete,
}: {
  log: CareLogRecord;
  onDelete?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">
            {log.student?.firstName} {log.student?.lastName}{" "}
            <span className="text-xs font-mono font-normal text-slate-500">
              ({log.student?.admissionNo})
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <strong>{log.classroom?.name}</strong> &bull; {formatDate(log.date)}{" "}
            {log.recordedBy ? `• Logged by ${log.recordedBy.fullName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              log.pickupVerified
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {log.pickupVerified ? "Pickup Verified" : "Awaiting Pickup"}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
              title="Delete log"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-2 border-t border-slate-100">
        <div>
          <span className="text-slate-400 block">Feeding</span>
          <strong>
            B: {FEEDING_STATUS_LABELS[log.breakfastStatus]} &bull; L:{" "}
            {FEEDING_STATUS_LABELS[log.lunchStatus]}
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block">Nap Time</span>
          <strong>
            {log.napDuration || "—"} ({SLEEP_QUALITY_LABELS[log.sleepQuality]})
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block">Health &amp; Hygiene</span>
          <strong>
            {log.diaperChecks} checks &bull; {log.temperature || "—"} &bull;{" "}
            {MOOD_LABELS[log.mood]}
          </strong>
        </div>
        <div>
          <span className="text-slate-400 block">Authorized Pickup</span>
          <strong>
            {log.pickupAuthorizedName || "—"}
            {log.pickupIdNumber ? ` (${log.pickupIdNumber})` : ""}
          </strong>
        </div>
      </div>

      {(log.feedingNotes || log.pottyNotes || log.healthNotes) && (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-0.5">
          {log.feedingNotes && <p>Meal: {log.feedingNotes}</p>}
          {log.pottyNotes && <p>Hygiene: {log.pottyNotes}</p>}
          {log.healthNotes && <p>Health: {log.healthNotes}</p>}
        </div>
      )}
    </div>
  );
}

export default function CrecheCarePage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 flex items-center justify-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        </div>
      }
    >
      <CrecheCareInner />
    </Suspense>
  );
}
