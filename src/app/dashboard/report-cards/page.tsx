"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Printer,
  Lock,
} from "lucide-react";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import { DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/format";
import { formatOrdinal } from "@/lib/grading";
import type { UserRole } from "@/lib/rbac";

interface TermItem {
  id: string;
  academicYear: string;
  termName: string;
  isCurrent: boolean;
}

interface ReportRow {
  studentId: string;
  admissionNo: string;
  fullName: string;
  classroomId: string | null;
  classroomName: string;
  department: string;
  subjectsCount: number;
  averageScore: number | null;
  overallPosition: number | null;
  classSize: number;
  jhsAggregate: number | null;
  jhsAggregateComplete: boolean;
  status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED";
  approvedBy: string | null;
}

export default function ReportCardsHubPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [termId, setTermId] = useState("");
  const [classrooms, setClassrooms] = useState<
    Array<{ id: string; name: string; department: string }>
  >([]);
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (termId) params.set("termId", termId);
      if (deptFilter !== "ALL") params.set("department", deptFilter);
      if (classFilter !== "ALL") params.set("classroomId", classFilter);

      const res = await fetch(`/api/report-cards?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRole(data.role);
        setTerms(data.terms || []);
        if (!termId && data.activeTerm?.id) setTermId(data.activeTerm.id);
        setClassrooms(data.classrooms || []);
        setRows(data.rows || []);
      } else {
        setToast({
          type: "error",
          text: data.error || "Failed to load report cards.",
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error loading report cards." });
    } finally {
      setLoading(false);
    }
  }, [classFilter, deptFilter, termId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function togglePublish(row: ReportRow) {
    if (!termId) return;
    setBusyId(row.studentId);
    setToast(null);
    const action = row.status === "PUBLISHED" ? "UNPUBLISH" : "PUBLISH";
    try {
      const res = await fetch(`/api/report-cards/${row.studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Action failed." });
      } else {
        setToast({
          type: "success",
          text:
            action === "PUBLISH"
              ? `Approved & Published report card for ${row.fullName}.`
              : `Moved ${row.fullName}'s report card back to Draft.`,
        });
        await loadReports();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function bulkPublishClass() {
    if (!termId || classFilter === "ALL") return;
    if (
      !confirm(
        "Approve and publish Terminal Report Cards for ALL students in the selected class?"
      )
    ) {
      return;
    }
    setBusyId("BULK");
    try {
      const res = await fetch("/api/report-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classroomId: classFilter, termId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Bulk publish failed." });
      } else {
        setToast({
          type: "success",
          text: `Headmaster approved & published ${data.count} report card(s).`,
        });
        await loadReports();
      }
    } finally {
      setBusyId(null);
    }
  }

  const isHeadmaster = role === "SUPER_ADMIN";

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Terminal Report Cards &amp; Approval
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {role === "PARENT"
              ? "View and print your ward's Headmaster-approved official Terminal Report Cards."
              : "Preview official printable Terminal Report Cards. Headmaster approval is required before publication."}
          </p>
        </div>

        {isHeadmaster && classFilter !== "ALL" && (
          <button
            type="button"
            onClick={bulkPublishClass}
            disabled={busyId === "BULK"}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shadow-xs cursor-pointer disabled:opacity-60 shrink-0"
          >
            {busyId === "BULK" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Approve &amp; Publish Class
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex flex-col sm:flex-row gap-3">
        <select
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.academicYear} — {t.termName} {t.isCurrent ? "(Active)" : ""}
            </option>
          ))}
        </select>

        {isHeadmaster && (
          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setClassFilter("ALL");
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
          >
            <option value="ALL">All Departments (KG, Primary, JHS)</option>
            {DEPARTMENTS.filter((d) => d.key !== "CRECHE").map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        )}

        {role !== "PARENT" && (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
          >
            <option value="ALL">All Classes</option>
            {classrooms
              .filter((c) => deptFilter === "ALL" || c.department === deptFilter)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <span className="text-sm">Compiling report cards...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <FileText className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-slate-700">
            No report cards found for this selection.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Performance
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Approval Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.studentId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {row.fullName}
                      </p>
                      <p className="text-xs font-mono text-slate-500">
                        {row.admissionNo}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">
                        {row.classroomName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {DEPARTMENT_LABELS[row.department] || row.department}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {row.department === "KINDERGARTEN" ? (
                        <span className="font-semibold text-amber-800">
                          {row.subjectsCount} KG Learning Area(s)
                        </span>
                      ) : row.department === "JHS" ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900">
                            {row.averageScore !== null
                              ? `${row.averageScore}%`
                              : "—"}{" "}
                            {row.overallPosition
                              ? `(${formatOrdinal(row.overallPosition)})`
                              : ""}
                          </p>
                          {row.jhsAggregate !== null && (
                            <span className="inline-flex rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-[11px] font-bold">
                              BECE Agg. {String(row.jhsAggregate).padStart(2, "0")}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="font-bold text-slate-900">
                          {row.averageScore !== null
                            ? `${row.averageScore}%`
                            : "—"}{" "}
                          {row.overallPosition
                            ? `• ${formatOrdinal(row.overallPosition)} of ${row.classSize}`
                            : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.status === "PUBLISHED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Published
                        </span>
                      ) : row.status === "PENDING_APPROVAL" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-bold">
                          <Clock className="h-3.5 w-3.5" /> Pending Approval
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-bold">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {isHeadmaster && (
                          <button
                            type="button"
                            disabled={busyId === row.studentId}
                            onClick={() => togglePublish(row)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                              row.status === "PUBLISHED"
                                ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                                : "bg-emerald-700 hover:bg-emerald-800 text-white"
                            }`}
                          >
                            {row.status === "PUBLISHED"
                              ? "Unpublish"
                              : "Approve & Publish"}
                          </button>
                        )}
                        {role === "PARENT" && row.status !== "PUBLISHED" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-500 px-3 py-1.5 text-xs font-semibold">
                            <Lock className="h-3.5 w-3.5" /> Awaiting Approval
                          </span>
                        ) : (
                          <Link
                            href={`/dashboard/report-cards/${row.studentId}?termId=${termId}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-semibold"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            View / Print
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
