"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  UserRound,
  Phone,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import {
  formatDate,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  type DepartmentKey,
} from "@/lib/format";
import type { UserRole } from "@/lib/rbac";

interface StudentRecord {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth: string | null;
  nhisNumber: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianNote: string | null;
  status: "ACTIVE" | "GRADUATED" | "TRANSFERRED";
  classroomId: string | null;
  parentId: string | null;
  classroom: {
    id: string;
    name: string;
    department: DepartmentKey;
    teacher?: { fullName: string } | null;
  } | null;
  parent: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  } | null;
}

interface ClassroomOption {
  id: string;
  name: string;
  department: DepartmentKey;
}

interface ParentOption {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}

const emptyForm = {
  admissionNo: "",
  firstName: "",
  lastName: "",
  gender: "MALE" as "MALE" | "FEMALE",
  dateOfBirth: "",
  nhisNumber: "",
  guardianName: "",
  guardianPhone: "",
  status: "ACTIVE" as "ACTIVE" | "GRADUATED" | "TRANSFERRED",
  department: "PRIMARY" as DepartmentKey,
  classroomId: "",
  parentId: "",
  guardianNote: "",
};

export default function StudentsPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
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
      if (classFilter !== "ALL") params.set("classroomId", classFilter);
      if (search.trim()) params.set("search", search.trim());

      const [meRes, studentsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/students?${params.toString()}`),
      ]);
      const meJson = await meRes.json();
      const sJson = await studentsRes.json();

      if (meJson.user) setRole(meJson.user.role);
      if (studentsRes.ok) {
        setStudents(sJson.students || []);
        setClassrooms(sJson.classrooms || []);
        setParents(sJson.parents || []);
      } else {
        setToast({
          type: "error",
          text: sJson.error || "Failed to fetch students.",
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error loading students." });
    } finally {
      setLoading(false);
    }
  }, [classFilter, deptFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreateModal() {
    setEditingId(null);
    const defaultDept: DepartmentKey = "PRIMARY";
    const firstPrimary = classrooms.find((c) => c.department === defaultDept);
    setForm({
      ...emptyForm,
      department: defaultDept,
      classroomId: firstPrimary?.id || "",
    });
    setModalOpen(true);
  }

  function openEditModal(s: StudentRecord) {
    setEditingId(s.id);
    setForm({
      admissionNo: s.admissionNo,
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth || "",
      nhisNumber: s.nhisNumber || "",
      guardianName: s.guardianName || s.parent?.fullName || "",
      guardianPhone: s.guardianPhone || s.parent?.phone || "",
      status: s.status,
      department: s.classroom?.department || "PRIMARY",
      classroomId: s.classroomId || "",
      parentId: s.parentId || "",
      guardianNote: s.guardianNote || "",
    });
    setModalOpen(true);
  }

  function handleDepartmentChange(newDept: DepartmentKey) {
    const firstInDept = classrooms.find((c) => c.department === newDept);
    setForm((prev) => ({
      ...prev,
      department: newDept,
      classroomId: firstInDept?.id || "",
    }));
  }

  function handleParentSelect(parentId: string) {
    const picked = parents.find((p) => p.id === parentId);
    setForm((prev) => ({
      ...prev,
      parentId,
      guardianName: picked ? picked.fullName : prev.guardianName,
      guardianPhone: picked?.phone ? picked.phone : prev.guardianPhone,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const url = editingId ? `/api/students/${editingId}` : "/api/students";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionNo: form.admissionNo || undefined,
          firstName: form.firstName,
          lastName: form.lastName,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth || null,
          nhisNumber: form.nhisNumber || null,
          guardianName: form.guardianName || null,
          guardianPhone: form.guardianPhone || null,
          guardianNote: form.guardianNote || null,
          status: form.status,
          classroomId: form.classroomId || null,
          parentId: form.parentId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Could not save student.",
        });
      } else {
        setModalOpen(false);
        setToast({
          type: "success",
          text: editingId
            ? "Student record updated in database."
            : `Registered ${data.student.firstName} ${data.student.lastName} — Student ID: ${data.student.admissionNo}.`,
        });
        await loadData();
      }
    } catch {
      setToast({ type: "error", text: "Network error while saving student." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: StudentRecord) {
    if (
      !confirm(
        `Delete student ${s.firstName} ${s.lastName} (${s.admissionNo})? This removes their attendance, scores, and fee records.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/students/${s.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setToast({ type: "error", text: data.error || "Delete failed." });
    } else {
      setToast({
        type: "success",
        text: `Removed ${s.firstName} ${s.lastName}.`,
      });
      await loadData();
    }
  }

  const canManage = role === "SUPER_ADMIN";
  const filteredFilterClasses =
    deptFilter === "ALL"
      ? classrooms
      : classrooms.filter((c) => c.department === deptFilter);
  const modalDeptClasses = classrooms.filter(
    (c) => c.department === form.department
  );

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {role === "PARENT" ? "My Enrolled Wards" : "Student Admissions & Directory"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {role === "PARENT"
              ? "View your children's department, class placement, teacher contact, and NHIS details."
              : "Register students with auto-generated Student IDs, assign departments/classes, and record guardian phone numbers."}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2.5 shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Register Student
          </button>
        )}
      </div>

      {/* Filters */}
      {role !== "PARENT" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Student ID, name, or guardian phone..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
          {role !== "TEACHER" && (
            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setClassFilter("ALL");
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:border-emerald-600 focus:outline-none"
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
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-white focus:border-emerald-600 focus:outline-none"
          >
            <option value="ALL">All Classes</option>
            {filteredFilterClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* List / Table */}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <span className="text-sm">Loading students...</span>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
          <UserRound className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            No students found
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Adjust your filter or register a new student.
          </p>
        </div>
      ) : role === "PARENT" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {students.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {s.admissionNo}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1.5">
                    {s.firstName} {s.lastName}
                  </h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {s.classroom?.name || "Unassigned"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block">Department</span>
                  <span className="font-medium text-slate-800">
                    {s.classroom
                      ? DEPARTMENT_LABELS[s.classroom.department]
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Date of Birth</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(s.dateOfBirth)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Class Teacher</span>
                  <span className="font-medium text-slate-800">
                    {s.classroom?.teacher?.fullName || "Unassigned"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">NHIS No.</span>
                  <span className="font-medium text-slate-800">
                    {s.nhisNumber || "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student &amp; ID</th>
                  <th className="px-4 py-3 font-semibold">Department / Class</th>
                  <th className="px-4 py-3 font-semibold">Parent / Guardian</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canManage && (
                    <th className="px-4 py-3 font-semibold text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => {
                  const deptMeta = DEPARTMENTS.find(
                    (d) => d.key === s.classroom?.department
                  );
                  const gName = s.guardianName || s.parent?.fullName;
                  const gPhone = s.guardianPhone || s.parent?.phone;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          {s.admissionNo} &bull; {s.gender}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex rounded-lg bg-slate-100 text-slate-800 px-2 py-0.5 text-xs font-bold">
                            {s.classroom?.name || "Unassigned"}
                          </span>
                          {deptMeta && (
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${deptMeta.badgeClass}`}
                            >
                              {deptMeta.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {gName || gPhone ? (
                          <div>
                            <p className="font-medium text-slate-800">
                              {gName || "Guardian"}
                            </p>
                            {gPhone && (
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {gPhone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            No contact saved
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            s.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.status}
                        </span>
                        {s.nhisNumber && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {s.nhisNumber}
                          </p>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(s)}
                              className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              title="Edit student"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                              title="Delete student"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register / Edit Student Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Student Record" : "Register New Student"}
        subtitle="Unique Student ID (e.g. SPS-2026-010) is auto-generated when left blank."
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                First Name *
              </label>
              <input
                required
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Last Name *
              </label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student ID
              </label>
              <input
                value={form.admissionNo}
                onChange={(e) =>
                  setForm({ ...form, admissionNo: e.target.value })
                }
                placeholder="Auto-generated"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gender *
              </label>
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm({
                    ...form,
                    gender: e.target.value as "MALE" | "FEMALE",
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) =>
                  setForm({ ...form, dateOfBirth: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Cascading Department & Class */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department *
              </label>
              <select
                value={form.department}
                onChange={(e) =>
                  handleDepartmentChange(e.target.value as DepartmentKey)
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
                Class *
              </label>
              <select
                required
                value={form.classroomId}
                onChange={(e) =>
                  setForm({ ...form, classroomId: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="">-- Select Class --</option>
                {modalDeptClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Parent / Guardian Phone & Optional Portal Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent / Guardian Name *
              </label>
              <input
                required
                value={form.guardianName}
                onChange={(e) =>
                  setForm({ ...form, guardianName: e.target.value })
                }
                placeholder="e.g. Mr. Samuel Boadu"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent / Guardian Phone (+233) *
              </label>
              <input
                required
                value={form.guardianPhone}
                onChange={(e) =>
                  setForm({ ...form, guardianPhone: e.target.value })
                }
                placeholder="+233 24 XXX XXXX"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link Parent Portal (Optional)
              </label>
              <select
                value={form.parentId}
                onChange={(e) => handleParentSelect(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="">-- None --</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NHIS Number
              </label>
              <input
                value={form.nhisNumber}
                onChange={(e) =>
                  setForm({ ...form, nhisNumber: e.target.value })
                }
                placeholder="NHIS-XXXXXXXX"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as
                      | "ACTIVE"
                      | "GRADUATED"
                      | "TRANSFERRED",
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="ACTIVE">Active</option>
                <option value="GRADUATED">Graduated</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
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
              {editingId ? "Update Student" : "Save Registration"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
