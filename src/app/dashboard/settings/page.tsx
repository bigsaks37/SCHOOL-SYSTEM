"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  CalendarDays,
  UserCog,
  Plus,
  CheckCircle2,
  Trash2,
  Loader2,
  Save,
  BookOpen,
  SlidersHorizontal,
  Database,
  Cloud,
  RefreshCw,
} from "lucide-react";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import { formatDate, DEPARTMENTS, type DepartmentKey } from "@/lib/format";
import type { UserRole } from "@/lib/rbac";

interface TermItem {
  id: string;
  academicYear: string;
  termName: string;
  startDate: string;
  endDate: string;
  nextTermReopeningDate: string | null;
  classScoreWeight: number;
  primaryGradingScale: "LETTER" | "BECE";
  isCurrent: boolean;
}

interface DeptSubjectItem {
  id: string;
  name: string;
  department: DepartmentKey;
  category: "CORE" | "ELECTIVE" | "LEARNING_AREA";
}

export default function SettingsPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // My profile form
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // School profile form (Super Admin)
  const [schoolForm, setSchoolForm] = useState({
    schoolName: "",
    motto: "",
    address: "",
    phone: "",
    email: "",
    gesCode: "",
  });
  const [savingSchool, setSavingSchool] = useState(false);

  // Academic Terms
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [editingTerm, setEditingTerm] = useState<TermItem | null>(null);
  const [savingTermEdit, setSavingTermEdit] = useState(false);
  const [termForm, setTermForm] = useState({
    academicYear: "2026/2027",
    termName: "Term 3" as "Term 1" | "Term 2" | "Term 3",
    startDate: "2027-05-04",
    endDate: "2027-07-30",
    nextTermReopeningDate: "2027-09-07",
    classScoreWeight: 50,
    primaryGradingScale: "LETTER" as "LETTER" | "BECE",
    isCurrent: false,
  });
  const [creatingTerm, setCreatingTerm] = useState(false);

  // Department Subjects & KG Learning Areas
  const [deptSubjects, setDeptSubjects] = useState<DeptSubjectItem[]>([]);
  const [subjectDeptTab, setSubjectDeptTab] =
    useState<DepartmentKey>("JHS");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCat, setNewSubjectCat] = useState<
    "CORE" | "ELECTIVE" | "LEARNING_AREA"
  >("CORE");
  const [addingSubject, setAddingSubject] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [neonStatus, setNeonStatus] = useState<{
    branch: string | null;
    branchId: string | null;
    services: {
      postgres: { ok: boolean; pooled: boolean; unpooledConfigured: boolean; studentsCount?: number };
      auth: { configured: boolean; hasActiveNeonSession: boolean; neonUserEmail: string | null };
      functions: { configured: boolean; ok: boolean; url: string | null; httpStatus: number | null };
      aiGateway: {
        configured: boolean;
        reachable: boolean;
        totalModels: number;
        enabledModels: Array<{ id: string }>;
        unavailableReason: string | null;
        recoveryUrl: string | null;
      };
      realtime: { configured: boolean; canSeal: boolean; urlConfigured: boolean };
    };
  } | null>(null);
  const [checkingNeon, setCheckingNeon] = useState(false);

  const loadNeonStatus = useCallback(async () => {
    setCheckingNeon(true);
    try {
      const res = await fetch("/api/neon/status");
      if (res.ok) {
        setNeonStatus(await res.json());
      }
    } catch {
      // ignore transient network errors
    } finally {
      setCheckingNeon(false);
    }
  }, []);

  async function handleLoadSampleData() {
    setLoadingDemo(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/seed-demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Failed to load sample data.",
        });
      } else {
        setToast({ type: "success", text: data.message });
        await loadSettings();
      }
    } finally {
      setLoadingDemo(false);
    }
  }

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, setRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/settings"),
      ]);
      const meJson = await meRes.json();
      const setJson = await setRes.json();

      if (meJson.user) {
        setRole(meJson.user.role);
        setProfileForm((prev) => ({
          ...prev,
          fullName: meJson.user.fullName || "",
          phone: meJson.user.phone || "",
        }));
      }

      if (setJson.school) {
        setSchoolForm({
          schoolName: setJson.school.schoolName,
          motto: setJson.school.motto,
          address: setJson.school.address,
          phone: setJson.school.phone,
          email: setJson.school.email,
          gesCode: setJson.school.gesCode,
        });
      }
      const loadedTerms: TermItem[] = setJson.terms || [];
      setTerms(loadedTerms);
      setDeptSubjects(setJson.departmentSubjects || []);

      const active = loadedTerms.find((t) => t.isCurrent) || loadedTerms[0];
      if (active) setEditingTerm(active);
    } catch {
      setToast({ type: "error", text: "Failed to load settings." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadNeonStatus();
  }, [loadSettings, loadNeonStatus]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setToast(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: profileForm.fullName,
          phone: profileForm.phone || null,
          ...(profileForm.newPassword
            ? {
              currentPassword: profileForm.currentPassword,
              newPassword: profileForm.newPassword,
            }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Update failed." });
      } else {
        setProfileForm((p) => ({
          ...p,
          currentPassword: "",
          newPassword: "",
        }));
        setToast({
          type: "success",
          text: "Your account profile has been updated.",
        });
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveSchool(e: React.FormEvent) {
    e.preventDefault();
    setSavingSchool(true);
    setToast(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schoolForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Save failed." });
      } else {
        setToast({ type: "success", text: "School profile saved to database." });
      }
    } finally {
      setSavingSchool(false);
    }
  }

  async function saveActiveTermConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTerm) return;
    setSavingTermEdit(true);
    setToast(null);
    try {
      const res = await fetch(`/api/settings/terms/${editingTerm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editingTerm.startDate,
          endDate: editingTerm.endDate,
          nextTermReopeningDate: editingTerm.nextTermReopeningDate || "",
          classScoreWeight: editingTerm.classScoreWeight,
          primaryGradingScale: editingTerm.primaryGradingScale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Failed to update term configuration.",
        });
      } else {
        setToast({
          type: "success",
          text: `Saved grading & reopening date settings for ${editingTerm.academicYear} ${editingTerm.termName}.`,
        });
        await loadSettings();
      }
    } finally {
      setSavingTermEdit(false);
    }
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    setCreatingTerm(true);
    setToast(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(termForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Could not create term.",
        });
      } else {
        setToast({
          type: "success",
          text: `Added ${data.term.academicYear} ${data.term.termName}.`,
        });
        await loadSettings();
      }
    } finally {
      setCreatingTerm(false);
    }
  }

  async function activateTerm(id: string) {
    const res = await fetch(`/api/settings/terms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activate: true }),
    });
    if (res.ok) {
      setToast({ type: "success", text: "Active academic term updated." });
      await loadSettings();
    }
  }

  async function deleteTerm(id: string) {
    if (!confirm("Delete this academic term?")) return;
    const res = await fetch(`/api/settings/terms/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "error", text: data.error || "Delete failed." });
    } else {
      setToast({ type: "success", text: "Academic term deleted." });
      await loadSettings();
    }
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setAddingSubject(true);
    setToast(null);
    try {
      const category =
        subjectDeptTab === "KINDERGARTEN" || subjectDeptTab === "CRECHE"
          ? "LEARNING_AREA"
          : newSubjectCat;

      const res = await fetch("/api/academics/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubjectName.trim(),
          department: subjectDeptTab,
          category,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Could not add subject." });
      } else {
        setNewSubjectName("");
        setToast({
          type: "success",
          text: `Assigned "${data.subject.name}" to ${subjectDeptTab}.`,
        });
        await loadSettings();
      }
    } finally {
      setAddingSubject(false);
    }
  }

  async function handleDeleteSubject(subj: DeptSubjectItem) {
    if (!confirm(`Remove "${subj.name}" from ${subj.department}?`)) return;
    const res = await fetch(`/api/academics/subjects/${subj.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setToast({ type: "success", text: `Removed "${subj.name}".` });
      await loadSettings();
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        <span className="text-sm">Loading settings...</span>
      </div>
    );
  }

  const subjectsInTab = deptSubjects.filter(
    (s) => s.department === subjectDeptTab
  );

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Super Admin Only: Academic Term Grading & Reopening Date + Subject Assignment */}
      {role === "SUPER_ADMIN" && (
        <>
          {/* 1. Active Term Reopening Date & Grading Configuration */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Academic Terms, Reopening Date &amp; Grading Policy
                </h2>
                <p className="text-xs text-slate-500">
                  Configure the active Academic Year, Term, Next Term Reopening
                  Date, Class/Exam weighting (30/70 or 50/50), and Primary
                  grading scale.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {terms.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-900 flex flex-wrap items-center gap-2">
                      {t.academicYear} — {t.termName}
                      {t.isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-bold">
                          <CheckCircle2 className="h-3 w-3" /> Active Term
                        </span>
                      )}
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        CA {t.classScoreWeight}% / Exam{" "}
                        {100 - t.classScoreWeight}%
                      </span>
                      <span className="rounded-md bg-sky-50 text-sky-800 px-2 py-0.5 text-[11px] font-semibold">
                        Primary:{" "}
                        {t.primaryGradingScale === "LETTER" ? "A–F" : "1–9 BECE"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(t.startDate)} – {formatDate(t.endDate)} &bull;{" "}
                      Next Term Reopens:{" "}
                      <strong className="text-slate-700">
                        {formatDate(t.nextTermReopeningDate)}
                      </strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingTerm(t)}
                      className="rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                    >
                      Configure
                    </button>
                    {!t.isCurrent && (
                      <>
                        <button
                          type="button"
                          onClick={() => activateTerm(t.id)}
                          className="rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                        >
                          Set Active
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTerm(t.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Delete term"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Edit Selected Term Config */}
            {editingTerm && (
              <form
                onSubmit={saveActiveTermConfig}
                className="rounded-xl bg-emerald-50/50 border border-emerald-200/80 p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                  <SlidersHorizontal className="h-4 w-4" />
                  Configure {editingTerm.academicYear} — {editingTerm.termName}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Term Start
                    </label>
                    <input
                      type="date"
                      value={editingTerm.startDate}
                      onChange={(e) =>
                        setEditingTerm({
                          ...editingTerm,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Term End
                    </label>
                    <input
                      type="date"
                      value={editingTerm.endDate}
                      onChange={(e) =>
                        setEditingTerm({
                          ...editingTerm,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Next Term Reopening
                    </label>
                    <input
                      type="date"
                      value={editingTerm.nextTermReopeningDate || ""}
                      onChange={(e) =>
                        setEditingTerm({
                          ...editingTerm,
                          nextTermReopeningDate: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Class / Exam Split
                    </label>
                    <select
                      value={editingTerm.classScoreWeight}
                      onChange={(e) =>
                        setEditingTerm({
                          ...editingTerm,
                          classScoreWeight: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value={50}>50% Class / 50% Exam</option>
                      <option value={30}>30% Class / 70% Exam</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Primary Scale
                    </label>
                    <select
                      value={editingTerm.primaryGradingScale}
                      onChange={(e) =>
                        setEditingTerm({
                          ...editingTerm,
                          primaryGradingScale: e.target.value as
                            | "LETTER"
                            | "BECE",
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="LETTER">A – F Letter Grades</option>
                      <option value="BECE">1 – 9 BECE Grades</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingTermEdit}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 cursor-pointer disabled:opacity-60"
                >
                  {savingTermEdit ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Term Configuration
                </button>
              </form>
            )}

            {/* Add New Term */}
            <form
              onSubmit={addTerm}
              className="grid grid-cols-1 sm:grid-cols-6 gap-3 pt-2 border-t border-slate-100 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Academic Year
                </label>
                <input
                  required
                  value={termForm.academicYear}
                  onChange={(e) =>
                    setTermForm({ ...termForm, academicYear: e.target.value })
                  }
                  placeholder="2026/2027"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Term
                </label>
                <select
                  value={termForm.termName}
                  onChange={(e) =>
                    setTermForm({
                      ...termForm,
                      termName: e.target.value as "Term 1" | "Term 2" | "Term 3",
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="Term 1">Term 1</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 3">Term 3</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={termForm.startDate}
                  onChange={(e) =>
                    setTermForm({ ...termForm, startDate: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={termForm.endDate}
                  onChange={(e) =>
                    setTermForm({ ...termForm, endDate: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Next Reopening
                </label>
                <input
                  type="date"
                  value={termForm.nextTermReopeningDate}
                  onChange={(e) =>
                    setTermForm({
                      ...termForm,
                      nextTermReopeningDate: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={creatingTerm}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 cursor-pointer disabled:opacity-60"
              >
                {creatingTerm ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Term
              </button>
            </form>
          </section>

          {/* 2. Assign Subjects / Learning Areas to Each Department */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Department Subjects &amp; KG Learning Areas
                </h2>
                <p className="text-xs text-slate-500">
                  Define Core &amp; Elective subjects for JHS (used in BECE
                  Aggregate), GES subjects for Primary, and Learning Areas for
                  Kindergarten.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map((dept) => {
                const count = deptSubjects.filter(
                  (s) => s.department === dept.key
                ).length;
                return (
                  <button
                    key={dept.key}
                    type="button"
                    onClick={() => setSubjectDeptTab(dept.key)}
                    className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold border transition cursor-pointer ${subjectDeptTab === dept.key
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                  >
                    {dept.label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {subjectsInTab.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  No subjects or learning areas configured for this department.
                </p>
              ) : (
                subjectsInTab.map((subj) => (
                  <span
                    key={subj.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800"
                  >
                    <span>{subj.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${subj.category === "CORE"
                          ? "bg-emerald-100 text-emerald-800"
                          : subj.category === "ELECTIVE"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      {subj.category === "LEARNING_AREA"
                        ? "MILESTONE"
                        : subj.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubject(subj)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      title="Remove subject"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            <form
              onSubmit={handleAddSubject}
              className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100"
            >
              <input
                required
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder={
                  subjectDeptTab === "KINDERGARTEN"
                    ? "New KG Learning Area (e.g. Motor Skills)"
                    : "New Subject Name (e.g. Career Technology)"
                }
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
              {(subjectDeptTab === "PRIMARY" || subjectDeptTab === "JHS") && (
                <select
                  value={newSubjectCat}
                  onChange={(e) =>
                    setNewSubjectCat(
                      e.target.value as "CORE" | "ELECTIVE" | "LEARNING_AREA"
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="CORE">Core Subject</option>
                  <option value="ELECTIVE">Elective Subject</option>
                </select>
              )}
              <button
                type="submit"
                disabled={addingSubject}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 cursor-pointer disabled:opacity-60"
              >
                {addingSubject ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add to {subjectDeptTab}
              </button>
            </form>
          </section>

          {/* 3. School Profile */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <Building2 className="h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  School Profile (GES Registration)
                </h2>
                <p className="text-xs text-slate-500">
                  Printed on Terminal Report Cards, fee receipts, and the
                  dashboard header.
                </p>
              </div>
            </div>

            <form onSubmit={saveSchool} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    School Name *
                  </label>
                  <input
                    required
                    value={schoolForm.schoolName}
                    onChange={(e) =>
                      setSchoolForm({
                        ...schoolForm,
                        schoolName: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GES School Code *
                  </label>
                  <input
                    required
                    value={schoolForm.gesCode}
                    onChange={(e) =>
                      setSchoolForm({ ...schoolForm, gesCode: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School Motto *
                </label>
                <input
                  required
                  value={schoolForm.motto}
                  onChange={(e) =>
                    setSchoolForm({ ...schoolForm, motto: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone *
                  </label>
                  <input
                    required
                    value={schoolForm.phone}
                    onChange={(e) =>
                      setSchoolForm({ ...schoolForm, phone: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={schoolForm.email}
                    onChange={(e) =>
                      setSchoolForm({ ...schoolForm, email: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Address *
                  </label>
                  <input
                    required
                    value={schoolForm.address}
                    onChange={(e) =>
                      setSchoolForm({ ...schoolForm, address: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSchool}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 cursor-pointer disabled:opacity-60"
              >
                {savingSchool ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Update School Profile
              </button>
            </form>
          </section>

          {/* 4. Neon Cloud Stack Live Status */}
          <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Cloud className="h-5 w-5 text-emerald-700" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Neon Cloud Services ({neonStatus?.branch || "production"})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live connectivity across Neon Postgres, Neon Auth, Neon
                    Functions, AI Gateway, and Neon Realtime.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadNeonStatus}
                disabled={checkingNeon}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${checkingNeon ? "animate-spin" : ""}`}
                />
                Refresh Status
              </button>
            </div>

            {neonStatus ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70">
                  <p className="font-bold text-slate-900">Postgres</p>
                  <p
                    className={`mt-1 font-semibold ${neonStatus.services.postgres.ok
                        ? "text-emerald-700"
                        : "text-red-600"
                      }`}
                  >
                    {neonStatus.services.postgres.ok ? "Connected" : "Offline"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {neonStatus.services.postgres.pooled ? "Pooled" : "Direct"} &bull;{" "}
                    {neonStatus.services.postgres.studentsCount ?? 0} students
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70">
                  <p className="font-bold text-slate-900">Neon Auth</p>
                  <p
                    className={`mt-1 font-semibold ${neonStatus.services.auth.configured
                        ? "text-emerald-700"
                        : "text-amber-700"
                      }`}
                  >
                    {neonStatus.services.auth.configured
                      ? "Configured"
                      : "Not Configured"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {neonStatus.services.auth.hasActiveNeonSession
                      ? neonStatus.services.auth.neonUserEmail
                      : "Managed Better Auth proxy ready"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70">
                  <p className="font-bold text-slate-900">Neon Functions</p>
                  <p
                    className={`mt-1 font-semibold ${neonStatus.services.functions.ok
                        ? "text-emerald-700"
                        : "text-amber-700"
                      }`}
                  >
                    {neonStatus.services.functions.ok
                      ? `Live (HTTP ${neonStatus.services.functions.httpStatus})`
                      : "Unavailable"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    hello School Pulse API
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70">
                  <p className="font-bold text-slate-900">AI Gateway</p>
                  <p
                    className={`mt-1 font-semibold ${neonStatus.services.aiGateway.enabledModels.length > 0
                        ? "text-emerald-700"
                        : neonStatus.services.aiGateway.reachable
                          ? "text-amber-700"
                          : "text-red-600"
                      }`}
                  >
                    {neonStatus.services.aiGateway.enabledModels.length > 0
                      ? `${neonStatus.services.aiGateway.enabledModels.length} Models Ready`
                      : neonStatus.services.aiGateway.reachable
                        ? `Reachable (${neonStatus.services.aiGateway.totalModels} models; credits needed)`
                        : "Unavailable"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {neonStatus.services.aiGateway.unavailableReason || "Ready"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70">
                  <p className="font-bold text-slate-900">Neon Realtime</p>
                  <p
                    className={`mt-1 font-semibold ${neonStatus.services.realtime.canSeal
                        ? "text-emerald-700"
                        : "text-amber-700"
                      }`}
                  >
                    {neonStatus.services.realtime.canSeal
                      ? "Sealed Live SQL Ready"
                      : "Not Configured"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Live Noticeboard stream
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Checking Neon services...
              </p>
            )}
          </section>

          {/* 5. One-Click Demo / Sample Ghanaian School Data Loader */}
          <section className="bg-white rounded-2xl border border-amber-200/90 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Demo &amp; Sample Ghanaian School Data
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                  Idempotently populate or refresh realistic Ghanaian students,
                  multi-child parent accounts, 14 classes across Creche, KG,
                  Primary &amp; JHS, sample scores, Creche care logs, and GH₵
                  fee records for immediate demonstration.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLoadSampleData}
              disabled={loadingDemo}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-xs sm:text-sm font-bold px-4 py-2.5 shadow-xs cursor-pointer disabled:opacity-60 shrink-0"
            >
              {loadingDemo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Load Sample Ghanaian School Data
            </button>
          </section>
        </>
      )}

      {/* Personal Account & Password (All Roles) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 mb-4">
          <UserCog className="h-5 w-5 text-emerald-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              My Account &amp; Password
            </h2>
            <p className="text-xs text-slate-500">
              Update your display name, Ghana phone number, or login password.
            </p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                required
                value={profileForm.fullName}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, fullName: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                value={profileForm.phone}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, phone: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password (to change password)
              </label>
              <input
                type="password"
                value={profileForm.currentPassword}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    currentPassword: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password (min 6 chars)
              </label>
              <input
                type="password"
                minLength={6}
                value={profileForm.newPassword}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    newPassword: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 cursor-pointer disabled:opacity-60"
          >
            {savingProfile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Account Changes
          </button>
        </form>
      </section>
    </div>
  );
}
