"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Search,
  Loader2,
  Radio,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import { DEPARTMENTS, type DepartmentKey } from "@/lib/format";

interface SmsLogItem {
  id: string;
  recipientName: string | null;
  recipientPhone: string;
  message: string;
  eventType: string;
  provider: string;
  status: string;
  providerRef: string | null;
  createdAt: string;
  sentBy: { fullName: string } | null;
}

const EVENT_BADGES: Record<string, { label: string; cls: string }> = {
  ABSENCE_ALERT: {
    label: "Absence Alert",
    cls: "bg-red-100 text-red-800",
  },
  FEE_RECEIPT: {
    label: "Fee Receipt",
    cls: "bg-emerald-100 text-emerald-800",
  },
  REPORT_PUBLISHED: {
    label: "Report Card",
    cls: "bg-sky-100 text-sky-800",
  },
  BULK_DEBTORS: {
    label: "Debtors Reminder",
    cls: "bg-amber-100 text-amber-800",
  },
  BULK_PARENTS: {
    label: "Bulk Parents",
    cls: "bg-violet-100 text-violet-800",
  },
  BULK_TEACHERS: {
    label: "Bulk Teachers",
    cls: "bg-slate-200 text-slate-800",
  },
  MANUAL: {
    label: "Direct SMS",
    cls: "bg-slate-100 text-slate-700",
  },
};

export default function SmsOutboxPage() {
  const [gateway, setGateway] = useState({
    provider: "SIMULATION",
    configuredProvider: "ARKESEL",
    isLive: false,
    senderId: "SankofaSch",
  });
  const [stats, setStats] = useState({
    totalCount: 0,
    absenceCount: 0,
    receiptCount: 0,
    reportCount: 0,
    bulkCount: 0,
  });
  const [logs, setLogs] = useState<SmsLogItem[]>([]);
  const [eventFilter, setEventFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Bulk SMS Composer Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    target: "ALL_PARENTS" as
      | "ALL_PARENTS"
      | "DEBTORS"
      | "DEPARTMENT_PARENTS"
      | "ALL_TEACHERS"
      | "SINGLE",
    department: "JHS" as DepartmentKey,
    singleName: "",
    singlePhone: "",
    message: "",
  });

  const loadSms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventFilter !== "ALL") params.set("eventType", eventFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/sms?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setGateway(data.gateway);
        setStats(data.stats);
        setLogs(data.logs || []);
      } else {
        setToast({
          type: "error",
          text: data.error || "Failed to load SMS Outbox.",
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error loading SMS Outbox." });
    } finally {
      setLoading(false);
    }
  }, [eventFilter, search]);

  useEffect(() => {
    loadSms();
  }, [loadSms]);

  function openComposer(presetTarget?: "ALL_PARENTS" | "DEBTORS") {
    const target = presetTarget || "ALL_PARENTS";
    setForm({
      target,
      department: "JHS",
      singleName: "",
      singlePhone: "",
      message:
        target === "DEBTORS"
          ? "Sankofa Preparatory & JHS Fee Reminder: Dear Parent, {studentName} has an outstanding Term 1 fee balance of {balance}. Kindly settle via MTN MoMo, Bank, or Accounts Desk. Thank you."
          : "Sankofa Preparatory & JHS: Dear Parent, kindly note that our PTA Meeting holds this Friday at 9:00 AM. Thank you for your partnership.",
    });
    setModalOpen(true);
  }

  async function handleSendBulk(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setToast(null);
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Failed to send SMS." });
      } else {
        setModalOpen(false);
        setToast({
          type: "success",
          text: `Dispatched ${data.sentCount} SMS message(s) via ${gateway.provider}.`,
        });
        await loadSms();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Ghanaian SMS Notifications &amp; Outbox Log
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Arkesel &amp; Hubtel ready. Automatically logs Absence Alerts, Fee
            Receipts, Published Report Cards, and Bulk SMS broadcasts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openComposer("DEBTORS")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-semibold px-3.5 py-2.5 cursor-pointer"
          >
            <Send className="h-4 w-4" />
            SMS Debtors
          </button>
          <button
            type="button"
            onClick={() => openComposer("ALL_PARENTS")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shadow-xs cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
            Send Bulk SMS
          </button>
        </div>
      </div>

      {/* Gateway Mode Banner */}
      <div
        className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
          gateway.isLive
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-sky-50 border-sky-200 text-sky-900"
        }`}
      >
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 shrink-0" />
          <span>
            SMS Gateway:{" "}
            <strong>
              {gateway.isLive
                ? `LIVE (${gateway.provider})`
                : `SIMULATION / LOG MODE (${gateway.configuredProvider} Ready)`}
            </strong>{" "}
            &bull; Sender ID: <strong>{gateway.senderId}</strong>
          </span>
        </div>
        <span className="opacity-80">
          {gateway.isLive
            ? "Messages are delivered live to Ghanaian mobile networks."
            : "Set ARKESEL_API_KEY or HUBTEL_CLIENT_ID in .env to switch to live delivery."}
        </span>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
          <p className="text-xs font-semibold text-slate-500">Total Logged SMS</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">
            {stats.totalCount}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
          <p className="text-xs font-semibold text-slate-500">Absence Alerts</p>
          <p className="text-xl font-extrabold text-red-600 mt-1">
            {stats.absenceCount}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
          <p className="text-xs font-semibold text-slate-500">Fee Receipts</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">
            {stats.receiptCount}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
          <p className="text-xs font-semibold text-slate-500">
            Report &amp; Bulk SMS
          </p>
          <p className="text-xl font-extrabold text-sky-700 mt-1">
            {stats.reportCount + stats.bulkCount}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phone number, recipient, or SMS text..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">All Trigger Types</option>
          <option value="ABSENCE_ALERT">Absence Alerts</option>
          <option value="FEE_RECEIPT">Fee Payment Receipts</option>
          <option value="REPORT_PUBLISHED">Report Cards Published</option>
          <option value="BULK_DEBTORS">Bulk Debtors Reminders</option>
          <option value="BULK_PARENTS">Bulk Parents</option>
          <option value="BULK_TEACHERS">Bulk Teachers</option>
        </select>
      </div>

      {/* SMS Outbox Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
            <span className="text-sm">Loading SMS Outbox...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No SMS logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Recipient Phone</th>
                  <th className="px-4 py-3 font-semibold">Trigger</th>
                  <th className="px-4 py-3 font-semibold">Message Text</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((item) => {
                  const badge = EVENT_BADGES[item.eventType] || {
                    label: item.eventType,
                    cls: "bg-slate-100 text-slate-700",
                  };
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-slate-900">
                          {item.recipientName || "Guardian"}
                        </p>
                        <p className="text-xs font-mono text-slate-500">
                          {item.recipientPhone}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-md leading-relaxed">
                        {item.message}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            item.status === "FAILED"
                              ? "bg-red-100 text-red-700"
                              : item.status === "SENT"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {item.status === "FAILED" ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Bulk SMS Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Send Bulk SMS Broadcast"
        subtitle={`Dispatches via ${gateway.isLive ? gateway.provider : "Simulation / Outbox Log"} (Sender ID: ${gateway.senderId})`}
      >
        <form onSubmit={handleSendBulk} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recipient Group *
            </label>
            <select
              value={form.target}
              onChange={(e) =>
                setForm({
                  ...form,
                  target: e.target.value as typeof form.target,
                })
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="ALL_PARENTS">All Parents / Guardians</option>
              <option value="DEBTORS">
                Debtors Only (Auto-fills {"{studentName}"} &amp; {"{balance}"})
              </option>
              <option value="DEPARTMENT_PARENTS">Parents by Department</option>
              <option value="ALL_TEACHERS">All Teaching Staff</option>
              <option value="SINGLE">Single Phone Number</option>
            </select>
          </div>

          {form.target === "DEPARTMENT_PARENTS" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <select
                value={form.department}
                onChange={(e) =>
                  setForm({
                    ...form,
                    department: e.target.value as DepartmentKey,
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.target === "SINGLE" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recipient Name
                </label>
                <input
                  value={form.singleName}
                  onChange={(e) =>
                    setForm({ ...form, singleName: e.target.value })
                  }
                  placeholder="e.g. Mr. Yaw Owusu"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghana Phone (+233) *
                </label>
                <input
                  required
                  value={form.singlePhone}
                  onChange={(e) =>
                    setForm({ ...form, singlePhone: e.target.value })
                  }
                  placeholder="+233 24 XXX XXXX"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                SMS Text *
              </label>
              <span className="text-[11px] text-slate-400">
                {form.message.length} / 480 chars
              </span>
            </div>
            <textarea
              required
              rows={4}
              maxLength={480}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
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
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send SMS Now
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
