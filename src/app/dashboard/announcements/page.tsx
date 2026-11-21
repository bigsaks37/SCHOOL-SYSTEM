"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pin, Pencil, Trash2, Loader2, Megaphone, Sparkles, Radio } from "lucide-react";
import { useLiveQuery } from "@neon/realtime-react";
import type { SealedLiveQuery } from "@neon/realtime/client";
import { Modal } from "@/components/Modal";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import {
  formatDate,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  type DepartmentKey,
} from "@/lib/format";
import { ROLE_META, type UserRole } from "@/lib/rbac";
import type { LiveAnnouncementRow } from "@/lib/realtimeServer";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  audience: "ALL" | "TEACHERS" | "PARENTS" | "STAFF";
  targetDepartment: "ALL" | DepartmentKey;
  pinned: boolean;
  createdAt: string;
  author: { id: string; fullName: string; role: string } | null;
}

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Everyone",
  TEACHERS: "Teachers Only",
  PARENTS: "Parents Only",
  STAFF: "Staff Only",
};

const emptyForm = {
  title: "",
  content: "",
  audience: "ALL" as "ALL" | "TEACHERS" | "PARENTS" | "STAFF",
  targetDepartment: "ALL" as "ALL" | DepartmentKey,
  pinned: false,
};

function LiveNoticeboardSync({
  sealedQuery,
  refreshQuery,
  onRows,
  onStatus,
}: {
  sealedQuery: SealedLiveQuery<LiveAnnouncementRow>;
  refreshQuery: () => Promise<SealedLiveQuery<LiveAnnouncementRow>>;
  onRows: (rows: AnnouncementItem[]) => void;
  onStatus: (status: string) => void;
}) {
  const { data, status } = useLiveQuery(sealedQuery, { refreshQuery });

  useEffect(() => {
    onStatus(status);
  }, [status, onStatus]);

  useEffect(() => {
    if (!data) return;
    onRows(
      data.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        audience: row.audience,
        targetDepartment: row.targetDepartment,
        pinned: Boolean(row.pinned),
        createdAt:
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : String(row.createdAt),
        author: row.authorId
          ? {
              id: row.authorId,
              fullName: row.authorFullName || "School Administration",
              role: row.authorRole || "SUPER_ADMIN",
            }
          : null,
      }))
    );
  }, [data, onRows]);

  return null;
}

export default function AnnouncementsPage() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: UserRole;
  } | null>(null);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [sealedQuery, setSealedQuery] =
    useState<SealedLiveQuery<LiveAnnouncementRow> | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string>("idle");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);

  const fetchSealedAnnouncements = useCallback(async () => {
    const res = await fetch("/api/realtime/announcements", { method: "POST" });
    if (!res.ok) throw new Error("Failed to seal live announcements query");
    const json = await res.json();
    return json.sealedQuery as SealedLiveQuery<LiveAnnouncementRow>;
  }, []);

  const handleLiveRows = useCallback((rows: AnnouncementItem[]) => {
    setItems(rows);
  }, []);

  const handleLiveStatus = useCallback((st: string) => {
    setRealtimeStatus(st);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, annRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/announcements"),
      ]);
      const meJson = await meRes.json();
      const annJson = await annRes.json();
      if (meJson.user) setCurrentUser(meJson.user);
      if (annRes.ok) setItems(annJson.announcements || []);
      else
        setToast({
          type: "error",
          text: annJson.error || "Failed to load notices.",
        });
    } catch {
      setToast({ type: "error", text: "Network error loading announcements." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetchSealedAnnouncements()
      .then((sq) => setSealedQuery(sq))
      .catch(() => setRealtimeStatus("offline"));
  }, [loadData, fetchSealedAnnouncements]);

  async function handleAiDraft() {
    const topic =
      form.title.trim() ||
      `School announcement for ${AUDIENCE_LABELS[form.audience]} in ${
        DEPARTMENT_LABELS[form.targetDepartment] || "All Departments"
      }`;
    setAiDrafting(true);
    setToast(null);
    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "announcement",
          prompt: `Topic: ${topic}. Audience: ${AUDIENCE_LABELS[form.audience]}. Department: ${
            DEPARTMENT_LABELS[form.targetDepartment] || "All Departments"
          }. Draft a concise, warm notice for Sankofa Preparatory & JHS in Accra, Ghana.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Neon AI Gateway could not generate a draft.",
        });
      } else {
        setForm((prev) => ({ ...prev, content: data.text }));
        setToast({
          type: "success",
          text: `Drafted with Neon AI Gateway (${data.model}).`,
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error contacting Neon AI Gateway." });
    } finally {
      setAiDrafting(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(a: AnnouncementItem) {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      audience: a.audience,
      targetDepartment: a.targetDepartment || "ALL",
      pinned: a.pinned,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const url = editingId
        ? `/api/announcements/${editingId}`
        : "/api/announcements";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Could not save notice.",
        });
      } else {
        setModalOpen(false);
        setToast({
          type: "success",
          text: editingId ? "Announcement updated." : "Announcement published.",
        });
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: AnnouncementItem) {
    if (!confirm(`Delete announcement "${a.title}"?`)) return;
    const res = await fetch(`/api/announcements/${a.id}`, { method: "DELETE" });
    if (res.ok) {
      setToast({ type: "success", text: "Announcement deleted." });
      await loadData();
    } else {
      const data = await res.json();
      setToast({ type: "error", text: data.error || "Delete failed." });
    }
  }

  const canPost =
    currentUser &&
    ["SUPER_ADMIN", "BURSAR", "TEACHER"].includes(currentUser.role);

  return (
    <div className="space-y-5">
      {sealedQuery && (
        <LiveNoticeboardSync
          key={sealedQuery.queryFingerprint}
          sealedQuery={sealedQuery}
          refreshQuery={fetchSealedAnnouncements}
          onRows={handleLiveRows}
          onStatus={handleLiveStatus}
        />
      )}
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              School Noticeboard &amp; Announcements
            </h2>
            {realtimeStatus === "live" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                <Radio className="h-3 w-3 animate-pulse text-emerald-600" />
                Live via Neon Realtime
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Target circulars to Everyone, Teachers Only, Parents Only, or a
            specific department (Creche, KG, Primary, JHS).
          </p>
        </div>

        {canPost && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2.5 shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            Post Announcement
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <span className="text-sm">Loading notices...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <Megaphone className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-slate-700">
            No announcements yet
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((a) => {
            const canEditThis =
              currentUser &&
              (currentUser.role === "SUPER_ADMIN" ||
                a.author?.id === currentUser.id);
            const authorRole = a.author?.role as UserRole | undefined;
            const deptMeta = DEPARTMENTS.find(
              (d) => d.key === a.targetDepartment
            );

            return (
              <article
                key={a.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs ${
                  a.pinned
                    ? "border-amber-300 ring-1 ring-amber-200/70"
                    : "border-slate-200/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-bold">
                          <Pin className="h-3 w-3" /> Pinned
                        </span>
                      )}
                      <span className="inline-flex rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[11px] font-semibold">
                        {AUDIENCE_LABELS[a.audience] || a.audience}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          deptMeta
                            ? deptMeta.badgeClass
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {DEPARTMENT_LABELS[a.targetDepartment] ||
                          "All Departments"}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {a.title}
                    </h3>
                  </div>

                  {canEditThis && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                        title="Edit notice"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        title="Delete notice"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {a.content}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>
                    Posted by{" "}
                    <strong className="text-slate-700">
                      {a.author?.fullName || "School Administration"}
                    </strong>{" "}
                    {authorRole && ROLE_META[authorRole]
                      ? `(${ROLE_META[authorRole].shortLabel})`
                      : ""}
                  </span>
                  <span>{formatDate(a.createdAt)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Announcement" : "Publish School Announcement"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Title *
            </label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. PTA Meeting, Mid-Term Break, BECE Mock Schedule"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Audience *
              </label>
              <select
                value={form.audience}
                onChange={(e) =>
                  setForm({
                    ...form,
                    audience: e.target.value as
                      | "ALL"
                      | "TEACHERS"
                      | "PARENTS"
                      | "STAFF",
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="ALL">All (Teachers &amp; Parents)</option>
                <option value="PARENTS">Parents Only</option>
                <option value="TEACHERS">Teachers Only</option>
                <option value="STAFF">All Staff Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Department *
              </label>
              <select
                value={form.targetDepartment}
                onChange={(e) =>
                  setForm({
                    ...form,
                    targetDepartment: e.target.value as "ALL" | DepartmentKey,
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                <option value="CRECHE">Creche / Daycare</option>
                <option value="KINDERGARTEN">Kindergarten (KG 1–2)</option>
                <option value="PRIMARY">Primary (Basic 1–6)</option>
                <option value="JHS">Junior High School (JHS 1–3)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Message Content *
              </label>
              <button
                type="button"
                onClick={handleAiDraft}
                disabled={aiDrafting}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-2.5 py-1 text-[11px] font-bold cursor-pointer disabled:opacity-60"
              >
                {aiDrafting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Draft with Neon AI
              </button>
            </div>
            <textarea
              required
              rows={5}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write your notice here..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {currentUser?.role === "SUPER_ADMIN" && (
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              Pin announcement to top of noticeboard
            </label>
          )}

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
              {editingId ? "Update Notice" : "Publish Notice"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
