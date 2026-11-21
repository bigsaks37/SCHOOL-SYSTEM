"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Briefcase,
  Phone,
  BookOpen,
  UserCheck,
  UserX,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  GHANA_BASIC_SUBJECTS,
} from "@/lib/format";

interface AssignedClass {
  id: string;
  name: string;
  department: string;
}

interface TeacherRecord {
  id: string;
  staffId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  qualification: string | null;
  subjects: string | null;
  isActive: boolean;
  assignedClasses: AssignedClass[];
}

interface ClassroomOption {
  id: string;
  name: string;
  department: string;
  teacherId: string | null;
  teacher: { fullName: string } | null;
}

const emptyForm = {
  staffId: "",
  fullName: "",
  email: "",
  phone: "",
  qualification: "",
  password: "",
  subjects: [] as string[],
  classroomIds: [] as string[],
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (deptFilter !== "ALL") params.set("department", deptFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/teachers?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setTeachers(data.teachers || []);
        setClassrooms(data.classrooms || []);
      } else {
        setToast({ type: "error", text: data.error || "Failed to load teachers." });
      }
    } catch {
      setToast({ type: "error", text: "Network error loading teachers." });
    } finally {
      setLoading(false);
    }
  }, [deptFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(t: TeacherRecord) {
    setEditingId(t.id);
    setForm({
      staffId: t.staffId || "",
      fullName: t.fullName,
      email: t.email,
      phone: t.phone || "",
      qualification: t.qualification || "",
      password: "",
      subjects: t.subjects
        ? t.subjects
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      classroomIds: t.assignedClasses.map((c) => c.id),
    });
    setModalOpen(true);
  }

  function toggleSubject(subj: string) {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subj)
        ? prev.subjects.filter((s) => s !== subj)
        : [...prev.subjects, subj],
    }));
  }

  function toggleClass(clsId: string) {
    setForm((prev) => ({
      ...prev,
      classroomIds: prev.classroomIds.includes(clsId)
        ? prev.classroomIds.filter((id) => id !== clsId)
        : [...prev.classroomIds, clsId],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const url = editingId ? `/api/teachers/${editingId}` : "/api/teachers";
      const method = editingId ? "PATCH" : "POST";
      const payload = editingId
        ? {
            staffId: form.staffId || null,
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            qualification: form.qualification || null,
            subjects: form.subjects,
            classroomIds: form.classroomIds,
            ...(form.password ? { password: form.password } : {}),
          }
        : form;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Could not save teacher." });
      } else {
        setModalOpen(false);
        setToast({
          type: "success",
          text: editingId
            ? `Updated teacher ${data.teacher.fullName}.`
            : `Registered teacher ${data.teacher.fullName} (${data.teacher.staffId}).`,
        });
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: TeacherRecord) {
    const res = await fetch(`/api/teachers/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    if (res.ok) {
      setToast({
        type: "success",
        text: `${t.fullName} is now ${!t.isActive ? "Active" : "Suspended"}.`,
      });
      await loadData();
    }
  }

  async function handleDelete(t: TeacherRecord) {
    if (
      !confirm(
        `Delete teacher ${t.fullName} (${t.staffId || t.email})? Their assigned classes will become unassigned.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/teachers/${t.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "error", text: data.error || "Delete failed." });
    } else {
      setToast({ type: "success", text: `Removed teacher ${t.fullName}.` });
      await loadData();
    }
  }

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Teacher &amp; Staff Admission
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Register teaching staff, assign them to Creche, KG, Primary, or JHS
            classes, and allocate GES subjects.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2.5 shadow-xs transition cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Register Teacher
        </button>
      </div>

      {/* Search & Department Filter */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by teacher name, Staff ID, phone, or subject..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
        >
          <option value="ALL">All Departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Teachers Table */}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <span className="text-sm">Loading teaching staff...</span>
        </div>
      ) : teachers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            No teachers match your search
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Teacher &amp; Staff ID</th>
                  <th className="px-4 py-3 font-semibold">Assigned Classes</th>
                  <th className="px-4 py-3 font-semibold">Subjects Taught</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {t.fullName}
                        </p>
                        {!t.isActive && (
                          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold">
                            SUSPENDED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {t.staffId || "No ID"}{" "}
                        {t.qualification ? `• ${t.qualification}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {t.assignedClasses.length === 0 ? (
                        <span className="text-xs text-slate-400">
                          Not assigned
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {t.assignedClasses.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[11px] font-semibold"
                            >
                              <BookOpen className="h-3 w-3" />
                              {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {t.subjects ? (
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {t.subjects}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400">General</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p className="font-medium text-slate-800">{t.email}</p>
                      {t.phone && (
                        <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {t.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleActive(t)}
                          className="p-2 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                          title={t.isActive ? "Suspend teacher" : "Activate teacher"}
                        >
                          {t.isActive ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          title="Edit teacher"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          title="Delete teacher"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register / Edit Teacher Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Teacher Profile & Assignments" : "Register New Teacher"}
        subtitle="Auto-generates Staff ID if left blank and creates their Teacher login account."
        maxWidthClass="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Mr. Daniel Mensah"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Staff ID (Auto-generated if blank)
              </label>
              <input
                value={form.staffId}
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                placeholder="e.g. STF-2026-005"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address (Login) *
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="teacher@sankofa.edu.gh"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number (+233) *
              </label>
              <input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+233 24 XXX XXXX"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Qualification
              </label>
              <input
                value={form.qualification}
                onChange={(e) =>
                  setForm({ ...form, qualification: e.target.value })
                }
                placeholder="e.g. B.Ed Basic Education"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {editingId ? "Reset Password (Optional)" : "Initial Login Password *"}
              </label>
              <input
                type="password"
                required={!editingId}
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingId ? "Leave blank to keep" : "Min 6 characters"}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Assign Specific Classes grouped by 4 Departments */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Assign to Classes ({form.classroomIds.length} selected)
            </label>
            <div className="rounded-xl border border-slate-200 p-3 space-y-3 max-h-48 overflow-y-auto bg-slate-50/50">
              {DEPARTMENTS.map((dept) => {
                const deptClasses = classrooms.filter(
                  (c) => c.department === dept.key
                );
                if (deptClasses.length === 0) return null;
                return (
                  <div key={dept.key}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      {DEPARTMENT_LABELS[dept.key]}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {deptClasses.map((c) => {
                        const checked = form.classroomIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleClass(c.id)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                              checked
                                ? "bg-emerald-700 text-white border-emerald-700"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assign Specific GES Subjects */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Assign Subjects ({form.subjects.length} selected)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GHANA_BASIC_SUBJECTS.map((subj) => {
                const active = form.subjects.includes(subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => toggleSubject(subj)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                      active
                        ? "bg-sky-700 text-white border-sky-700"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {subj}
                  </button>
                );
              })}
            </div>
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
              {editingId ? "Update Teacher" : "Register Teacher"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
