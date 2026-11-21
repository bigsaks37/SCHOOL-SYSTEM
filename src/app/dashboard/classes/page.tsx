"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ClipboardCheck,
  BookOpen,
  Baby,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  type DepartmentKey,
} from "@/lib/format";
import type { UserRole } from "@/lib/rbac";

interface ClassroomItem {
  id: string;
  name: string;
  department: DepartmentKey;
  capacity: number;
  teacherId: string | null;
  teacher: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
  _count: { students: number };
}

interface TeacherOption {
  id: string;
  fullName: string;
  email: string;
  staffId?: string | null;
}

const emptyForm = {
  name: "",
  department: "PRIMARY" as DepartmentKey,
  capacity: 30,
  teacherId: "",
};

export default function ClassesPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [classes, setClasses] = useState<ClassroomItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [deptTab, setDeptTab] = useState<"ALL" | DepartmentKey>("ALL");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, clsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/classes"),
      ]);
      const meJson = await meRes.json();
      const clsJson = await clsRes.json();
      if (meJson.user) setRole(meJson.user.role);
      if (clsRes.ok) {
        setClasses(clsJson.classes || []);
        setTeachers(clsJson.teachers || []);
      } else {
        setToast({
          type: "error",
          text: clsJson.error || "Failed to load classes.",
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error loading classes." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      department: deptTab === "ALL" ? "PRIMARY" : deptTab,
    });
    setModalOpen(true);
  }

  function openEdit(c: ClassroomItem) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      department: c.department,
      capacity: c.capacity,
      teacherId: c.teacherId || "",
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const url = editingId ? `/api/classes/${editingId}` : "/api/classes";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          teacherId: form.teacherId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Could not save class.",
        });
      } else {
        setModalOpen(false);
        setToast({
          type: "success",
          text: editingId
            ? `Updated ${data.classroom.name}.`
            : `Created class ${data.classroom.name}.`,
        });
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: ClassroomItem) {
    if (
      !confirm(
        `Delete class "${c.name}"? Students in this class will become unassigned.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/classes/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "error", text: data.error || "Delete failed." });
    } else {
      setToast({ type: "success", text: `Deleted class ${c.name}.` });
      await loadData();
    }
  }

  const canManage = role === "SUPER_ADMIN";
  const visibleClasses =
    deptTab === "ALL"
      ? classes
      : classes.filter((c) => c.department === deptTab);

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {role === "TEACHER"
              ? "My Assigned Classes"
              : "Ghanaian Academic Departments & Classes"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Organize classes across Creche/Daycare, Kindergarten (KG 1–2),
            Primary (Basic 1–6), and JHS (JHS 1–3).
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2.5 shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Class
          </button>
        )}
      </div>

      {/* 4-Department Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDeptTab("ALL")}
          className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer border ${
            deptTab === "ALL"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          All ({classes.length})
        </button>
        {DEPARTMENTS.map((dept) => {
          const count = classes.filter((c) => c.department === dept.key).length;
          const active = deptTab === dept.key;
          return (
            <button
              key={dept.key}
              type="button"
              onClick={() => setDeptTab(dept.key)}
              className={`rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer border ${
                active
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {dept.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <span className="text-sm">Loading classrooms...</span>
        </div>
      ) : visibleClasses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            No classes found in this department
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleClasses.map((c) => {
            const deptMeta = DEPARTMENTS.find((d) => d.key === c.department);
            const pct = Math.min(
              100,
              Math.round((c._count.students / Math.max(1, c.capacity)) * 100)
            );
            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          deptMeta?.badgeClass ||
                          "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {DEPARTMENT_LABELS[c.department] || c.department}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1.5">
                        {c.name}
                      </h3>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          title="Edit class"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Delete class"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mt-2">
                    Class Teacher:{" "}
                    <strong className="text-slate-800">
                      {c.teacher?.fullName || "Unassigned"}
                    </strong>
                  </p>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> Enrolment
                      </span>
                      <span className="font-bold text-slate-800">
                        {c._count.students} / {c.capacity}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          deptMeta?.barClass || "bg-emerald-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/attendance?classroomId=${c.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Take Attendance
                  </Link>
                  {c.department === "CRECHE" ? (
                    <Link
                      href={`/dashboard/creche-care?classroomId=${c.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-pink-50 border border-pink-200 px-2.5 py-1 text-xs font-semibold text-pink-700 hover:bg-pink-100"
                    >
                      <Baby className="h-3.5 w-3.5" />
                      Daily Care Reports
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/assessments"
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Scores &rarr;
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Classroom" : "Create New Class"}
        subtitle="Assign this class to one of the four Ghanaian academic departments."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Class Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Creche B, KG 1 Gold, Basic 3B, JHS 3"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department *
              </label>
              <select
                value={form.department}
                onChange={(e) =>
                  setForm({
                    ...form,
                    department: e.target.value as DepartmentKey,
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label} ({d.range})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Capacity *
              </label>
              <input
                type="number"
                min={5}
                max={100}
                required
                value={form.capacity}
                onChange={(e) =>
                  setForm({ ...form, capacity: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assigned Class Teacher
            </label>
            <select
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="">-- Unassigned --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} {t.staffId ? `(${t.staffId})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Update Class" : "Create Class"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
