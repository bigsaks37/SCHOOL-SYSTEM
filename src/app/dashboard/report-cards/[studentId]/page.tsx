"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Save,
  Lock,
  Send,
  Sparkles,
} from "lucide-react";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import { formatDate, DEPARTMENT_LABELS } from "@/lib/format";
import { KG_MASTERY_RATINGS, type JhsAggregateResult } from "@/lib/grading";
import type { UserRole } from "@/lib/rbac";

interface ReportPayload {
  role: UserRole;
  published: boolean;
  status?: string;
  message?: string;
  school?: {
    schoolName: string;
    motto: string;
    address: string;
    phone: string;
    email: string;
    gesCode: string;
  };
  terms: Array<{ id: string; academicYear: string; termName: string }>;
  term: {
    id: string;
    academicYear: string;
    termName: string;
    startDate: string;
    endDate: string;
    nextTermReopeningDate: string | null;
    classScoreWeight: number;
    primaryGradingScale: string;
  };
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    gender?: string;
    classroomName: string;
    department: string;
    classTeacher?: string;
    guardianName?: string;
  };
  attendance?: { presentDays: number; totalDays: number; rate: number };
  subjects?: Array<{
    id: string;
    subject: string;
    subjectCategory: string;
    classScore: number;
    examScore: number;
    totalScore: number;
    grade: string;
    masteryRating: string | null;
    remarks: string | null;
    position: number | null;
    positionLabel: string;
  }>;
  overall?: {
    averageScore: number | null;
    overallPosition: number | null;
    overallPositionLabel: string;
    classSize: number;
    totalSubjects: number;
  };
  jhsAggregate?: JhsAggregateResult | null;
  reportCard?: {
    status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED";
    teacherRemarks: string | null;
    conduct: string | null;
    interest: string | null;
    headmasterRemarks: string | null;
    approvedBy: { fullName: string } | null;
    approvedAt: string | null;
    publishedAt: string | null;
  };
}

function ReportCardInner() {
  const params = useParams<{ studentId: string }>();
  const searchParams = useSearchParams();
  const studentId = params.studentId;
  const [termId, setTermId] = useState(searchParams.get("termId") || "");

  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiDraftingField, setAiDraftingField] = useState<
    "teacherRemarks" | "headmasterRemarks" | null
  >(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [remarksForm, setRemarksForm] = useState({
    teacherRemarks: "",
    conduct: "",
    interest: "",
    headmasterRemarks: "",
  });

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const qs = termId ? `?termId=${termId}` : "";
      const res = await fetch(`/api/report-cards/${studentId}${qs}`);
      const json = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: json.error || "Unable to load report card.",
        });
        return;
      }
      setData(json);
      if (!termId && json.term?.id) setTermId(json.term.id);
      if (json.reportCard) {
        setRemarksForm({
          teacherRemarks: json.reportCard.teacherRemarks || "",
          conduct: json.reportCard.conduct || "",
          interest: json.reportCard.interest || "",
          headmasterRemarks: json.reportCard.headmasterRemarks || "",
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error loading report card." });
    } finally {
      setLoading(false);
    }
  }, [studentId, termId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  async function handleAiDraftRemark(
    field: "teacherRemarks" | "headmasterRemarks"
  ) {
    if (!data) return;
    setAiDraftingField(field);
    setToast(null);
    try {
      const roleLabel =
        field === "headmasterRemarks" ? "Headmaster" : "Class Teacher";
      const summary = `Student: ${data.student.fullName} (${data.student.classroomName}, ${data.student.department}). Attendance: ${data.attendance?.rate ?? 0}%. Average: ${data.overall?.averageScore ?? "N/A"}%. Position: ${data.overall?.overallPositionLabel ?? "N/A"}. ${data.jhsAggregate?.aggregate
          ? `BECE Aggregate: ${data.jhsAggregate.aggregate}.`
          : ""
        } Write a 2-sentence ${roleLabel} terminal report card remark.`;
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "report_remark", prompt: summary }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: json.error || "Neon AI Gateway could not generate remark.",
        });
      } else {
        setRemarksForm((prev) => ({ ...prev, [field]: json.text }));
        setToast({
          type: "success",
          text: `Drafted ${roleLabel} remark via Neon AI Gateway (${json.model}).`,
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error contacting Neon AI Gateway." });
    } finally {
      setAiDraftingField(null);
    }
  }

  async function submitAction(
    action: "SAVE_DRAFT" | "SUBMIT_APPROVAL" | "PUBLISH" | "UNPUBLISH"
  ) {
    if (!data?.term?.id) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch(`/api/report-cards/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termId: data.term.id,
          ...remarksForm,
          action,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: json.error || "Save failed." });
      } else {
        setToast({
          type: "success",
          text:
            action === "PUBLISH"
              ? "Terminal Report Card approved by Headmaster and Published!"
              : action === "SUBMIT_APPROVAL"
                ? "Submitted to Headmaster for approval."
                : action === "UNPUBLISH"
                  ? "Report card returned to Draft."
                  : "Remarks saved to database.",
        });
        await loadReport();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        <span className="text-sm">Generating Terminal Report Card...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <p className="text-sm text-slate-600">Report card not available.</p>
        <Link
          href="/dashboard/report-cards"
          className="inline-block mt-3 text-sm font-semibold text-emerald-700 hover:underline"
        >
          &larr; Back to Report Cards
        </Link>
      </div>
    );
  }

  // Parent trying to view unpublished draft
  if (data.role === "PARENT" && !data.published) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/report-cards"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Report Cards
        </Link>
        <div className="bg-white rounded-2xl border border-amber-200 p-10 text-center max-w-xl mx-auto">
          <Lock className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 mt-3">
            Awaiting Headmaster Approval
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            {data.message ||
              "This Terminal Report Card has not yet been approved and published by the Headmaster."}
          </p>
        </div>
      </div>
    );
  }

  const isKg = data.student.department === "KINDERGARTEN";
  const isJhs = data.student.department === "JHS";
  const classWeight = data.term.classScoreWeight;
  const examWeight = 100 - classWeight;
  const status = data.reportCard?.status || "DRAFT";
  const isHeadmaster = data.role === "SUPER_ADMIN";
  const isStaff = data.role === "SUPER_ADMIN" || data.role === "TEACHER";

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="no-print">
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      </div>

      {/* Top Non-Print Action Toolbar */}
      <div className="no-print bg-white rounded-2xl border border-slate-200/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/report-cards"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold bg-white"
          >
            {data.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicYear} — {t.termName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isHeadmaster && status !== "PUBLISHED" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => submitAction("PUBLISH")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-3.5 py-2 cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              Approve &amp; Publish
            </button>
          )}
          {isHeadmaster && status === "PUBLISHED" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => submitAction("UNPUBLISH")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 cursor-pointer"
            >
              Revert to Draft
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 shadow-xs cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* OFFICIAL PRINTABLE TERMINAL REPORT CARD SHEET */}
      <div className="report-card-sheet bg-white rounded-2xl border-2 border-emerald-900/20 shadow-sm overflow-hidden">
        {/* School Crest & Official Header */}
        <div className="bg-emerald-900 text-white px-6 py-5 border-b-4 border-amber-400">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center shrink-0 shadow">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase">
                  {data.school?.schoolName || "Sankofa Preparatory & JHS"}
                </h1>
                <p className="text-xs italic text-amber-300 font-medium">
                  &ldquo;{data.school?.motto || "Excellence, Integrity & Service"}&rdquo;
                </p>
                <p className="text-xs text-emerald-100 mt-1">
                  {data.school?.address} &bull; Tel: {data.school?.phone} &bull;{" "}
                  {data.school?.email}
                </p>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <span className="inline-block rounded-lg bg-white/15 border border-white/25 px-3 py-1 text-[11px] font-bold tracking-wider uppercase">
                GES Code: {data.school?.gesCode || "GES-GA-0419"}
              </span>
              <p className="text-sm font-extrabold text-amber-300 uppercase tracking-wide mt-2">
                Terminal Report Card
              </p>
            </div>
          </div>
        </div>

        {/* Publication Status Ribbon */}
        <div
          className={`px-6 py-2 flex items-center justify-between text-xs font-bold border-b ${status === "PUBLISHED"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {status === "PUBLISHED" ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                OFFICIAL PUBLISHED REPORT — Approved by Headmaster
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-amber-600" />
                {status === "PENDING_APPROVAL"
                  ? "PENDING HEADMASTER APPROVAL — Not Yet Visible to Parents"
                  : "DRAFT PREVIEW — Requires Headmaster Approval Before Publication"}
              </>
            )}
          </span>
          <span>
            {data.term.academicYear} &bull; {data.term.termName}
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Student Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Student Name
              </span>
              <strong className="text-sm text-slate-900">
                {data.student.fullName}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Student ID
              </span>
              <strong className="text-sm font-mono text-slate-900">
                {data.student.admissionNo}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Class &amp; Department
              </span>
              <strong className="text-sm text-slate-900">
                {data.student.classroomName} (
                {DEPARTMENT_LABELS[data.student.department] ||
                  data.student.department}
                )
              </strong>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Attendance
              </span>
              <strong className="text-sm text-emerald-800">
                {data.attendance?.presentDays ?? 0} out of{" "}
                {data.attendance?.totalDays ?? 0} days (
                {data.attendance?.rate ?? 0}%)
              </strong>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Overall Class Position
              </span>
              <strong className="text-sm text-slate-900">
                {!isKg && data.overall?.overallPosition
                  ? `${data.overall.overallPositionLabel} out of ${data.overall.classSize}`
                  : isKg
                    ? "Early Childhood Mastery"
                    : "—"}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Class Average / Teacher
              </span>
              <strong className="text-sm text-slate-900">
                {!isKg && data.overall?.averageScore !== null
                  ? `${data.overall?.averageScore}%`
                  : data.student.classTeacher}
              </strong>
            </div>
          </div>

          {/* Subject Breakdown Table */}
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
              {isKg
                ? "Early Childhood Developmental Milestones & Learning Areas"
                : "Academic Performance Breakdown"}
            </h2>

            {isKg ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Learning Area</th>
                      <th className="px-4 py-2.5 font-bold">Mastery Rating</th>
                      <th className="px-4 py-2.5 font-bold">
                        Teacher&apos;s Milestone Observation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(data.subjects || []).map((s) => {
                      const meta = KG_MASTERY_RATINGS.find(
                        (m) => m.key === s.masteryRating
                      );
                      return (
                        <tr key={s.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {s.subject}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${meta?.badgeClass ||
                                "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                            >
                              {s.grade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {s.remarks || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-100 text-left text-[11px] uppercase text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5 font-bold">Subject</th>
                      <th className="px-3 py-2.5 font-bold text-center">
                        Class ({classWeight}%)
                      </th>
                      <th className="px-3 py-2.5 font-bold text-center">
                        Exam ({examWeight}%)
                      </th>
                      <th className="px-3 py-2.5 font-bold text-center">
                        Total (100%)
                      </th>
                      <th className="px-3 py-2.5 font-bold text-center">
                        Grade
                      </th>
                      <th className="px-3 py-2.5 font-bold text-center">
                        Pos.
                      </th>
                      <th className="px-3.5 py-2.5 font-bold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(data.subjects || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-6 text-center text-slate-500"
                        >
                          No subject scores recorded for this term yet.
                        </td>
                      </tr>
                    ) : (
                      (data.subjects || []).map((s) => (
                        <tr key={s.id}>
                          <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                            {s.subject}
                            <span className="ml-1.5 text-[10px] font-bold text-slate-400 uppercase">
                              ({s.subjectCategory === "CORE" ? "Core" : "Elec"})
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-700">
                            {s.classScore}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-700">
                            {s.examScore}
                          </td>
                          <td className="px-3 py-2.5 text-center font-extrabold text-slate-900">
                            {s.totalScore}
                          </td>
                          <td className="px-3 py-2.5 text-center font-extrabold text-emerald-800">
                            {s.grade}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-700">
                            {s.positionLabel}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600">
                            {s.remarks || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* JHS BECE Aggregate Calculator Box */}
          {isJhs && data.jhsAggregate && (
            <div className="rounded-xl border-2 border-emerald-700/30 bg-emerald-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                  JHS BECE Aggregate Score (Best 6 Subjects)
                </p>
                <p className="text-xs text-slate-600">
                  {data.jhsAggregate.note}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.jhsAggregate.coresUsed.map((c) => (
                    <span
                      key={c.subject}
                      className="rounded bg-white border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-900"
                    >
                      {c.subject}: <strong>{c.grade}</strong>
                    </span>
                  ))}
                  {data.jhsAggregate.electivesUsed.map((e) => (
                    <span
                      key={e.subject}
                      className="rounded bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-semibold text-sky-900"
                    >
                      {e.subject}: <strong>{e.grade}</strong>
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-900 text-white px-5 py-3 text-center shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                  Aggregate
                </p>
                <p className="text-3xl font-black leading-tight">
                  {data.jhsAggregate.aggregate !== null
                    ? String(data.jhsAggregate.aggregate).padStart(2, "0")
                    : "—"}
                </p>
              </div>
            </div>
          )}

          {/* Remarks & Official Headmaster Stamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
              <p className="font-extrabold uppercase tracking-wider text-slate-600">
                Class Teacher&apos;s Report
              </p>
              <p className="text-slate-800 leading-relaxed min-h-[42px]">
                {data.reportCard?.teacherRemarks ||
                  "Teacher remarks have not been entered yet."}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block">Conduct</span>
                  <strong className="text-slate-800">
                    {data.reportCard?.conduct || "Satisfactory"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Interest / Talent</span>
                  <strong className="text-slate-800">
                    {data.reportCard?.interest || "—"}
                  </strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Class Teacher: <strong>{data.student.classTeacher}</strong>
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 text-xs">
              <div>
                <p className="font-extrabold uppercase tracking-wider text-slate-600">
                  Headmaster&apos;s Remarks &amp; Approval
                </p>
                <p className="text-slate-800 leading-relaxed mt-1.5 min-h-[36px]">
                  {data.reportCard?.headmasterRemarks ||
                    (status === "PUBLISHED"
                      ? "Approved and released by the Office of the Headmaster."
                      : "Pending Headmaster review and signature.")}
                </p>
              </div>

              {status === "PUBLISHED" ? (
                <div className="rounded-xl border-2 border-dashed border-emerald-700 bg-emerald-50/60 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                      Official Headmaster Stamp
                    </p>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {data.reportCard?.approvedBy?.fullName || "Headmaster"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Approved: {formatDate(data.reportCard?.approvedAt)}
                    </p>
                  </div>
                  <ShieldCheck className="h-9 w-9 text-emerald-700 shrink-0" />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-slate-500 font-semibold">
                  Not Yet Stamped / Published
                </div>
              )}
            </div>
          </div>

          {/* Next Term Reopening Footer */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-amber-950">
              Next Term Reopening Date:{" "}
              <strong className="text-sm">
                {formatDate(data.term.nextTermReopeningDate)}
              </strong>
            </span>
            <span className="text-amber-800">
              Generated by Sankofa SMS &bull; {data.school?.schoolName}
            </span>
          </div>
        </div>
      </div>

      {/* Staff Remarks & Approval Editor (Hidden when Printing) */}
      {isStaff && (
        <div className="no-print bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">
            Edit Remarks &amp; Approval Workflow
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Conduct
              </label>
              <input
                value={remarksForm.conduct}
                onChange={(e) =>
                  setRemarksForm({ ...remarksForm, conduct: e.target.value })
                }
                placeholder="e.g. Respectful & Punctual"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Interest / Co-Curricular
              </label>
              <input
                value={remarksForm.interest}
                onChange={(e) =>
                  setRemarksForm({ ...remarksForm, interest: e.target.value })
                }
                placeholder="e.g. Reading, Coding & Football"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Class Teacher&apos;s Remarks
              </label>
              <button
                type="button"
                disabled={aiDraftingField !== null}
                onClick={() => handleAiDraftRemark("teacherRemarks")}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-2.5 py-1 text-[11px] font-bold cursor-pointer disabled:opacity-60"
              >
                {aiDraftingField === "teacherRemarks" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Draft with Neon AI
              </button>
            </div>
            <textarea
              rows={2}
              value={remarksForm.teacherRemarks}
              onChange={(e) =>
                setRemarksForm({
                  ...remarksForm,
                  teacherRemarks: e.target.value,
                })
              }
              placeholder="Write encouraging and constructive terminal remarks..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {isHeadmaster && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Headmaster&apos;s Remarks (Admin Only)
                </label>
                <button
                  type="button"
                  disabled={aiDraftingField !== null}
                  onClick={() => handleAiDraftRemark("headmasterRemarks")}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-2.5 py-1 text-[11px] font-bold cursor-pointer disabled:opacity-60"
                >
                  {aiDraftingField === "headmasterRemarks" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Draft with Neon AI
                </button>
              </div>
              <textarea
                rows={2}
                value={remarksForm.headmasterRemarks}
                onChange={(e) =>
                  setRemarksForm({
                    ...remarksForm,
                    headmasterRemarks: e.target.value,
                  })
                }
                placeholder="Official Headmaster endorsement..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={() => submitAction("SAVE_DRAFT")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold px-4 py-2 cursor-pointer disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Save Remarks
            </button>

            {data.role === "TEACHER" && status !== "PUBLISHED" && (
              <button
                type="button"
                disabled={saving}
                onClick={() => submitAction("SUBMIT_APPROVAL")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-semibold px-4 py-2 cursor-pointer disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                Submit for Headmaster Approval
              </button>
            )}

            {isHeadmaster && (
              <button
                type="button"
                disabled={saving}
                onClick={() => submitAction("PUBLISH")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 cursor-pointer disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Save, Approve &amp; Publish
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportCardDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex items-center justify-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        </div>
      }
    >
      <ReportCardInner />
    </Suspense>
  );
}
