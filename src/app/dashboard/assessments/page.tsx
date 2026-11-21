"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Save,
  Loader2,
  Award,
  FileText,
  Trophy,
  Sparkles,
  Settings,
} from "lucide-react";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import { DEPARTMENT_LABELS } from "@/lib/format";
import {
  KG_MASTERY_RATINGS,
  computeDepartmentGrade,
  computeRankMap,
  formatOrdinal,
  type MasteryRatingKey,
  type JhsAggregateResult,
} from "@/lib/grading";
import type { UserRole } from "@/lib/rbac";

interface TermItem {
  id: string;
  academicYear: string;
  termName: string;
  classScoreWeight: number;
  primaryGradingScale: "LETTER" | "BECE";
  isCurrent: boolean;
}

interface ClassroomItem {
  id: string;
  name: string;
  department: "KINDERGARTEN" | "PRIMARY" | "JHS";
}

interface DeptSubjectItem {
  id: string;
  name: string;
  department: string;
  category: "CORE" | "ELECTIVE" | "LEARNING_AREA";
}

interface StudentItem {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  classroom: { id: string; name: string; department: string } | null;
}

interface AssessmentRow {
  id: string;
  studentId: string;
  subject: string;
  subjectCategory: string;
  classScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  masteryRating: MasteryRatingKey | null;
  remarks: string | null;
  student: {
    id: string;
    admissionNo: string;
    firstName: string;
    lastName: string;
    classroom: { name: string; department: string } | null;
  };
}

interface BroadsheetRow {
  studentId: string;
  admissionNo: string;
  fullName: string;
  subjectsRecorded: number;
  averageScore: number | null;
  overallPosition: number | null;
  classSize: number;
  jhsAggregate: JhsAggregateResult | null;
  reportStatus: string;
}

export default function AssessmentsPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [tab, setTab] = useState<"entry" | "broadsheet">("entry");
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [activeTerm, setActiveTerm] = useState<TermItem | null>(null);
  const [termId, setTermId] = useState("");
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [classroomId, setClassroomId] = useState("");
  const [activeClass, setActiveClass] = useState<ClassroomItem | null>(null);
  const [deptSubjects, setDeptSubjects] = useState<DeptSubjectItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [broadsheet, setBroadsheet] = useState<BroadsheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Local editable sheet state keyed by studentId
  const [sheetRows, setSheetRows] = useState<
    Record<
      string,
      {
        classScore: number;
        examScore: number;
        masteryRating: MasteryRatingKey;
        remarks: string;
      }
    >
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (termId) params.set("termId", termId);
      if (classroomId) params.set("classroomId", classroomId);

      const res = await fetch(`/api/assessments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Failed to load grading workspace.",
        });
        return;
      }

      setRole(data.role);
      setTerms(data.terms || []);
      setActiveTerm(data.activeTerm || null);
      if (!termId && data.activeTerm?.id) setTermId(data.activeTerm.id);

      setClassrooms(data.classrooms || []);
      setActiveClass(data.activeClass || null);
      if (data.activeClass?.id && data.activeClass.id !== classroomId) {
        setClassroomId(data.activeClass.id);
      }

      const subjectsList: DeptSubjectItem[] = data.departmentSubjects || [];
      setDeptSubjects(subjectsList);
      setStudents(data.students || []);
      setAssessments(data.assessments || []);
      setBroadsheet(data.broadsheet || []);

      setSelectedSubject((prev) => {
        if (prev && subjectsList.some((s) => s.name === prev)) return prev;
        return subjectsList[0]?.name || "";
      });
    } catch {
      setToast({ type: "error", text: "Network error loading grading sheet." });
    } finally {
      setLoading(false);
    }
  }, [classroomId, termId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Hydrate editable sheet whenever selectedSubject, students, or assessments change
  useEffect(() => {
    if (!selectedSubject || students.length === 0) return;
    const next: typeof sheetRows = {};
    for (const s of students) {
      const existing = assessments.find(
        (a) => a.studentId === s.id && a.subject === selectedSubject
      );
      next[s.id] = {
        classScore: existing?.classScore ?? 0,
        examScore: existing?.examScore ?? 0,
        masteryRating: existing?.masteryRating || "MEETING",
        remarks: existing?.remarks || "",
      };
    }
    setSheetRows(next);
  }, [selectedSubject, students, assessments]);

  async function handleSaveSheet() {
    if (!activeClass || !activeTerm || !selectedSubject || students.length === 0) {
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const subjMeta = deptSubjects.find((s) => s.name === selectedSubject);
      const isKg = activeClass.department === "KINDERGARTEN";

      const entries = students.map((s) => {
        const row = sheetRows[s.id] || {
          classScore: 0,
          examScore: 0,
          masteryRating: "MEETING" as MasteryRatingKey,
          remarks: "",
        };
        return isKg
          ? {
              studentId: s.id,
              masteryRating: row.masteryRating,
              remarks: row.remarks,
            }
          : {
              studentId: s.id,
              classScore: Number(row.classScore || 0),
              examScore: Number(row.examScore || 0),
            };
      });

      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classroomId: activeClass.id,
          termId: activeTerm.id,
          subject: selectedSubject,
          subjectCategory: subjMeta?.category,
          entries,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Failed to save scores." });
      } else {
        setToast({
          type: "success",
          text: isKg
            ? `Saved KG Mastery Ratings for ${data.count} pupil(s) in ${selectedSubject}.`
            : `Saved ${selectedSubject} scores & auto-calculated grades/rankings for ${data.count} student(s).`,
        });
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  // PARENT VIEW
  if (role === "PARENT") {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Ward Academic Scores &amp; Progress
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              View your ward&apos;s term assessments or open their official
              published Terminal Report Card.
            </p>
          </div>
          <Link
            href="/dashboard/report-cards"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2.5"
          >
            <FileText className="h-4 w-4" />
            Open Report Cards
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5">
          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicYear} — {t.termName} {t.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
            </div>
          ) : assessments.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No scores recorded for this term yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Ward</th>
                    <th className="px-4 py-3 font-semibold">Subject / Area</th>
                    <th className="px-4 py-3 font-semibold text-center">Result</th>
                    <th className="px-4 py-3 font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assessments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {a.student.firstName} {a.student.lastName}
                        <span className="block text-xs font-normal text-slate-500">
                          {a.student.classroom?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {a.subject}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.masteryRating ? (
                          <span className="inline-flex rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                            {a.grade}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            {a.totalScore}% (Grade {a.grade})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {a.remarks || "—"}
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

  const isKg = activeClass?.department === "KINDERGARTEN";
  const classWeight = activeTerm?.classScoreWeight ?? 50;
  const examWeight = 100 - classWeight;
  const primaryScale = activeTerm?.primaryGradingScale || "LETTER";

  // Live subject rank preview for Primary/JHS entry sheet
  const liveSubjectRankMap = !isKg
    ? computeRankMap(
        students.map((s) => ({
          id: s.id,
          score:
            Number(sheetRows[s.id]?.classScore || 0) +
            Number(sheetRows[s.id]?.examScore || 0),
        }))
      )
    : new Map<string, number>();

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Ghanaian Academic Grading Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            KG descriptive mastery ratings, Primary/JHS{" "}
            {classWeight}/{examWeight} score sheets, auto-ranking, and JHS BECE
            6-subject Aggregate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setTab("entry")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold cursor-pointer ${
                tab === "entry"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600"
              }`}
            >
              <Award className="h-4 w-4" />
              Score Sheet
            </button>
            <button
              type="button"
              onClick={() => setTab("broadsheet")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold cursor-pointer ${
                tab === "broadsheet"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600"
              }`}
            >
              <Trophy className="h-4 w-4" />
              Class Rankings
            </button>
          </div>

          {role === "SUPER_ADMIN" && (
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2"
            >
              <Settings className="h-3.5 w-3.5" />
              Subjects &amp; Weights
            </Link>
          )}
        </div>
      </div>

      {/* Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Academic Term
          </label>
          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.academicYear} — {t.termName} {t.isCurrent ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Class (KG / Primary / JHS)
          </label>
          <select
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
          >
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({DEPARTMENT_LABELS[c.department]})
              </option>
            ))}
          </select>
        </div>

        {tab === "entry" && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {isKg ? "KG Learning Area" : "Subject"}
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
            >
              {deptSubjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} (
                  {s.category === "LEARNING_AREA" ? "Milestone" : s.category})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <span className="text-sm">Loading grading sheet...</span>
        </div>
      ) : !activeClass || students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Award className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-slate-700">
            No gradable students found in this class
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Creche toddlers use Daily Care Logs instead of academic grading.
          </p>
        </div>
      ) : tab === "entry" ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {isKg ? (
                  <Sparkles className="h-4 w-4 text-amber-500" />
                ) : (
                  <Award className="h-4 w-4 text-emerald-700" />
                )}
                <h3 className="font-bold text-slate-900">
                  {activeClass.name} — {selectedSubject}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isKg
                  ? "Kindergarten Early Childhood Mastery Mode — select descriptive ratings (no exam numbers)."
                  : activeClass.department === "JHS"
                  ? `JHS BECE 1–9 Scale • Class Score (Max ${classWeight}) + Exam Score (Max ${examWeight}) = 100%`
                  : `Primary ${primaryScale === "LETTER" ? "A–F" : "1–9"} Scale • Class Score (Max ${classWeight}) + Exam Score (Max ${examWeight}) = 100%`}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveSheet}
              disabled={saving || !selectedSubject}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isKg ? "Save KG Assessments" : "Save Score Sheet"}
            </button>
          </div>

          {isKg ? (
            /* KINDERGARTEN DESCRIPTIVE MASTERY SHEET */
            <div className="divide-y divide-slate-100">
              {students.map((s) => {
                const row = sheetRows[s.id] || {
                  classScore: 0,
                  examScore: 0,
                  masteryRating: "MEETING" as MasteryRatingKey,
                  remarks: "",
                };
                return (
                  <div
                    key={s.id}
                    className="p-4 sm:p-5 flex flex-col gap-3"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          {s.admissionNo}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {KG_MASTERY_RATINGS.map((m) => {
                          const active = row.masteryRating === m.key;
                          return (
                            <button
                              key={m.key}
                              type="button"
                              onClick={() =>
                                setSheetRows((prev) => ({
                                  ...prev,
                                  [s.id]: { ...row, masteryRating: m.key },
                                }))
                              }
                              className={`rounded-xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                                active
                                  ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={row.remarks}
                      onChange={(e) =>
                        setSheetRows((prev) => ({
                          ...prev,
                          [s.id]: { ...row, remarks: e.target.value },
                        }))
                      }
                      placeholder={`Observation note for ${s.firstName} in ${selectedSubject}...`}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            /* PRIMARY & JHS NUMERIC SCORE ENTRY SHEET */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Class ({classWeight}%)
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Exam ({examWeight}%)
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Total (100%)
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Grade &amp; Remark
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Subj. Pos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => {
                    const row = sheetRows[s.id] || {
                      classScore: 0,
                      examScore: 0,
                      masteryRating: "MEETING" as MasteryRatingKey,
                      remarks: "",
                    };
                    const total = Number(
                      (
                        Number(row.classScore || 0) + Number(row.examScore || 0)
                      ).toFixed(1)
                    );
                    const computed = computeDepartmentGrade(
                      total,
                      activeClass.department,
                      primaryScale
                    );
                    const pos = liveSubjectRankMap.get(s.id);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-xs font-mono text-slate-500">
                            {s.admissionNo}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={classWeight}
                            step="0.5"
                            value={row.classScore}
                            onChange={(e) =>
                              setSheetRows((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...row,
                                  classScore: Math.min(
                                    classWeight,
                                    Math.max(0, Number(e.target.value))
                                  ),
                                },
                              }))
                            }
                            className="w-20 rounded-xl border border-slate-300 px-2.5 py-1.5 text-center font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={examWeight}
                            step="0.5"
                            value={row.examScore}
                            onChange={(e) =>
                              setSheetRows((prev) => ({
                                ...prev,
                                [s.id]: {
                                  ...row,
                                  examScore: Math.min(
                                    examWeight,
                                    Math.max(0, Number(e.target.value))
                                  ),
                                },
                              }))
                            }
                            className="w-20 rounded-xl border border-slate-300 px-2.5 py-1.5 text-center font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-center font-extrabold text-slate-900">
                          {total}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            {computed.grade} &bull; {computed.remarks}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">
                          {formatOrdinal(pos)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CLASS BROADSHEET & RANKINGS TAB */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                {activeClass.name} — Overall Rankings &amp; Report Cards
              </h3>
              <p className="text-xs text-slate-500">
                {activeClass.department === "JHS"
                  ? "Includes automatic BECE Aggregate (4 Core + Best 2 Electives)."
                  : "Automatically ranked across all recorded term subjects."}
              </p>
            </div>
            <Link
              href="/dashboard/report-cards"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              All Report Cards &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Subjects
                  </th>
                  {!isKg && (
                    <>
                      <th className="px-4 py-3 font-semibold text-center">
                        Average
                      </th>
                      <th className="px-4 py-3 font-semibold text-center">
                        Class Position
                      </th>
                    </>
                  )}
                  {activeClass.department === "JHS" && (
                    <th className="px-4 py-3 font-semibold text-center">
                      BECE Aggregate
                    </th>
                  )}
                  <th className="px-4 py-3 font-semibold text-center">
                    Report Status
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {broadsheet.map((row) => (
                  <tr key={row.studentId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {row.fullName}
                      </p>
                      <p className="text-xs font-mono text-slate-500">
                        {row.admissionNo}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 font-medium">
                      {row.subjectsRecorded}
                    </td>
                    {!isKg && (
                      <>
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {row.averageScore !== null
                            ? `${row.averageScore}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-700">
                          {row.overallPosition
                            ? `${formatOrdinal(row.overallPosition)} of ${row.classSize}`
                            : "—"}
                        </td>
                      </>
                    )}
                    {activeClass.department === "JHS" && (
                      <td className="px-4 py-3 text-center">
                        {row.jhsAggregate?.aggregate !== null &&
                        row.jhsAggregate?.aggregate !== undefined ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                              row.jhsAggregate.isComplete
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            Agg. {String(row.jhsAggregate.aggregate).padStart(2, "0")}
                            {!row.jhsAggregate.isComplete ? " (Prov.)" : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          row.reportStatus === "PUBLISHED"
                            ? "bg-emerald-100 text-emerald-800"
                            : row.reportStatus === "PENDING_APPROVAL"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.reportStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/report-cards/${row.studentId}?termId=${activeTerm?.id || ""}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-semibold"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Report Card
                      </Link>
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
