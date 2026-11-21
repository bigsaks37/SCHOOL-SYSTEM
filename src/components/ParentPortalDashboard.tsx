"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Baby,
  Utensils,
  Moon,
  HeartPulse,
  ShieldCheck,
  ClipboardCheck,
  Wallet,
  FileText,
  Printer,
  Smartphone,
  Megaphone,
  Pin,
  Lock,
  CheckCircle2,
  Loader2,
  Download,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import {
  formatGHS,
  formatDate,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  FEEDING_STATUS_LABELS,
  SLEEP_QUALITY_LABELS,
  MOOD_LABELS,
  PAYMENT_METHOD_LABELS,
  MOMO_NETWORK_LABELS,
} from "@/lib/format";

export interface ParentWardSummary {
  id: string;
  admissionNo: string;
  fullName: string;
  gender?: string;
  classroom: string;
  department: string;
  teacherName: string;
  teacherPhone?: string | null;
  billed: number;
  paid: number;
  balance: number;
  feeStatus?: "PAID" | "PARTIAL" | "OWING";
  itemizedBill?: Array<{ id: string; title: string; amount: number }>;
  recentReceipts?: Array<{
    id: string;
    receiptNo: string;
    amountPaid: number;
    paymentMethod: string;
    momoNetwork: string | null;
    paidAt: string;
    feeItemLabel: string | null;
  }>;
  attendanceRate?: number;
  recentAttendance?: Array<{
    id: string;
    date: string;
    status: string;
    remarks: string | null;
  }>;
  avgScore: number | null;
  jhsAggregate?: number | null;
  reportCard?: {
    status: string;
    published: boolean;
    approvedAt: string | null;
  };
  crecheCareLog?: {
    id: string;
    date: string;
    breakfastStatus: string;
    lunchStatus: string;
    feedingNotes: string | null;
    napDuration: string | null;
    sleepQuality: string;
    diaperChecks: number;
    pottyNotes: string | null;
    temperature: string | null;
    mood: string;
    healthNotes: string | null;
    pickupAuthorizedName: string | null;
    pickupIdType: string | null;
    pickupIdNumber: string | null;
    pickupTime: string | null;
    pickupVerified: boolean;
  } | null;
}

interface ParentPortalProps {
  currentTerm: { id?: string; academicYear: string; termName: string } | null;
  parentPhone?: string | null;
  stats: Record<string, number>;
  wards: ParentWardSummary[];
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    audience: string;
    targetDepartment?: string;
    pinned: boolean;
    createdAt: string;
    author: { fullName: string; role: string } | null;
  }>;
  onRefresh: () => void;
}

export function ParentPortalDashboard({
  currentTerm,
  parentPhone,
  stats,
  wards,
  announcements,
  onRefresh,
}: ParentPortalProps) {
  const [selectedWardId, setSelectedWardId] = useState(wards[0]?.id || "");
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [channel, setChannel] = useState<"mobile_money" | "card">(
    "mobile_money"
  );
  const [momoNetwork, setMomoNetwork] = useState<"MTN" | "TELECEL" | "AT">(
    "MTN"
  );
  const [momoPhone, setMomoPhone] = useState(parentPhone || "+233 24 900 4411");
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [newReceiptId, setNewReceiptId] = useState<string | null>(null);

  const activeWard =
    wards.find((w) => w.id === selectedWardId) || wards[0] || null;

  function openPayModal(ward: ParentWardSummary) {
    setPayAmount(ward.balance > 0 ? String(ward.balance) : "200");
    setPayOpen(true);
  }

  async function handlePaystackPay(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWard) return;
    setPaying(true);
    setToast(null);
    try {
      const res = await fetch("/api/finance/paystack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: activeWard.id,
          amountGhs: Number(payAmount),
          channelPreference: channel,
          momoNetwork,
          momoPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: "error", text: data.error || "Payment failed." });
      } else {
        setPayOpen(false);
        if (data.payment?.id) setNewReceiptId(data.payment.id);
        setToast({
          type: "success",
          text: `${data.message} — Official Receipt ${data.payment?.receiptNo || ""} issued!`,
        });
        onRefresh();
      }
    } finally {
      setPaying(false);
    }
  }

  const wardDeptMeta = DEPARTMENTS.find(
    (d) => d.key === activeWard?.department
  );
  const wardAnnouncements = announcements.filter(
    (a) =>
      !a.targetDepartment ||
      a.targetDepartment === "ALL" ||
      a.targetDepartment === activeWard?.department
  );

  return (
    <div className="space-y-6">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {newReceiptId && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 flex items-center justify-between gap-3">
          <p className="text-xs sm:text-sm font-bold text-emerald-900">
            Payment successful! Your official GH₵ fee receipt is ready.
          </p>
          <Link
            href={`/dashboard/finance/receipts/${newReceiptId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-2 shrink-0"
          >
            <Printer className="h-3.5 w-3.5" /> Print Receipt
          </Link>
        </div>
      )}

      {/* Family Welcome Header */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 text-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Parent / Guardian Family Portal
            </p>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">
              {currentTerm
                ? `${currentTerm.academicYear} — ${currentTerm.termName}`
                : "My Children's School Progress"}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 mt-1">
              Switch between your {wards.length} enrolled child(ren) below to
              check attendance, fees, Creche care logs, and published report
              cards.
            </p>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-right shrink-0">
            <p className="text-[11px] uppercase tracking-wider text-emerald-200 font-semibold">
              Family Total Balance
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-amber-300">
              {formatGHS(stats.outstandingBalance ?? 0)}
            </p>
          </div>
        </div>

        {/* Multi-Child Switcher Pills */}
        {wards.length > 0 && (
          <div className="mt-5 flex gap-2.5 overflow-x-auto pb-1">
            {wards.map((ward) => {
              const isSelected = ward.id === activeWard?.id;
              return (
                <button
                  key={ward.id}
                  type="button"
                  onClick={() => setSelectedWardId(ward.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition shrink-0 cursor-pointer border ${
                    isSelected
                      ? "bg-white text-slate-900 border-white shadow-md"
                      : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                      isSelected
                        ? "bg-emerald-700 text-white"
                        : "bg-white/15 text-amber-300"
                    }`}
                  >
                    {ward.department === "CRECHE" ? (
                      <Baby className="h-4 w-4" />
                    ) : (
                      ward.fullName
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                    )}
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold leading-tight">
                      {ward.fullName}
                    </p>
                    <p
                      className={`text-[11px] ${
                        isSelected ? "text-emerald-700 font-semibold" : "text-emerald-200"
                      }`}
                    >
                      {ward.classroom} &bull; {ward.department}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!activeWard ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          No children are currently linked to your Parent account. Contact the
          Headmaster.
        </div>
      ) : (
        <>
          {/* Selected Child Profile Strip */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900">
                  {activeWard.fullName}
                </h3>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                  {activeWard.admissionNo}
                </span>
                {wardDeptMeta && (
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${wardDeptMeta.badgeClass}`}
                  >
                    {activeWard.classroom} ({wardDeptMeta.label})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Class Teacher:{" "}
                <strong className="text-slate-700">
                  {activeWard.teacherName}
                </strong>
                {activeWard.teacherPhone ? ` • ${activeWard.teacherPhone}` : ""}
              </p>
            </div>

            {activeWard.balance > 0 && (
              <button
                type="button"
                onClick={() => openPayModal(activeWard)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shadow-xs cursor-pointer shrink-0"
              >
                <Smartphone className="h-4 w-4" />
                Pay Balance via Paystack ({formatGHS(activeWard.balance)})
              </button>
            )}
          </div>

          {/* DEPARTMENT-AWARE CRECHE DAILY CARE LOG (Prominent when child is in Creche!) */}
          {activeWard.department === "CRECHE" && (
            <div className="bg-white rounded-2xl border-2 border-pink-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-pink-600 text-white flex items-center justify-center shrink-0">
                    <Baby className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Creche Daily Care Report — {activeWard.fullName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {activeWard.crecheCareLog
                        ? `Latest care report (${formatDate(activeWard.crecheCareLog.date)})`
                        : "Waiting for today's toddler care report from Creche teacher"}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/creche-care"
                  className="text-xs font-semibold text-pink-700 hover:underline"
                >
                  View Past Care Logs &rarr;
                </Link>
              </div>

              {activeWard.crecheCareLog ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3.5 space-y-1">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Utensils className="h-4 w-4" /> Feeding
                    </p>
                    <p>
                      Breakfast:{" "}
                      <strong>
                        {
                          FEEDING_STATUS_LABELS[
                            activeWard.crecheCareLog.breakfastStatus
                          ]
                        }
                      </strong>
                    </p>
                    <p>
                      Lunch:{" "}
                      <strong>
                        {
                          FEEDING_STATUS_LABELS[
                            activeWard.crecheCareLog.lunchStatus
                          ]
                        }
                      </strong>
                    </p>
                    {activeWard.crecheCareLog.feedingNotes && (
                      <p className="text-slate-600 pt-1">
                        {activeWard.crecheCareLog.feedingNotes}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-sky-50 border border-sky-200/80 p-3.5 space-y-1">
                    <p className="font-bold text-sky-900 flex items-center gap-1.5">
                      <Moon className="h-4 w-4" /> Nap Time
                    </p>
                    <p>
                      Duration:{" "}
                      <strong>
                        {activeWard.crecheCareLog.napDuration || "—"}
                      </strong>
                    </p>
                    <p>
                      Sleep Quality:{" "}
                      <strong>
                        {
                          SLEEP_QUALITY_LABELS[
                            activeWard.crecheCareLog.sleepQuality
                          ]
                        }
                      </strong>
                    </p>
                  </div>

                  <div className="rounded-xl bg-pink-50 border border-pink-200/80 p-3.5 space-y-1">
                    <p className="font-bold text-pink-900 flex items-center gap-1.5">
                      <HeartPulse className="h-4 w-4" /> Health &amp; Hygiene
                    </p>
                    <p>
                      Diaper/Potty:{" "}
                      <strong>{activeWard.crecheCareLog.diaperChecks}x</strong>{" "}
                      &bull; {activeWard.crecheCareLog.temperature || "Normal"}
                    </p>
                    <p>
                      Mood:{" "}
                      <strong>
                        {MOOD_LABELS[activeWard.crecheCareLog.mood]}
                      </strong>
                    </p>
                    {activeWard.crecheCareLog.pottyNotes && (
                      <p className="text-slate-600 pt-1">
                        {activeWard.crecheCareLog.pottyNotes}
                      </p>
                    )}
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 space-y-1 ${
                      activeWard.crecheCareLog.pickupVerified
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />{" "}
                      Pickup Status
                    </p>
                    <p className="font-semibold text-slate-800">
                      {activeWard.crecheCareLog.pickupAuthorizedName || "Pending"}
                    </p>
                    <p className="text-[11px] font-bold text-emerald-700">
                      {activeWard.crecheCareLog.pickupVerified
                        ? `Verified ${
                            activeWard.crecheCareLog.pickupTime
                              ? `@ ${activeWard.crecheCareLog.pickupTime}`
                              : ""
                          }`
                        : "Child Safely in Creche Care"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No Creche care report recorded yet today.
                </p>
              )}
            </div>
          )}

          {/* Main 3-Panel Grid for Selected Child */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Fees, Attendance & Terminal Report Card */}
            <div className="lg:col-span-2 space-y-6">
              {/* Published Terminal Report Card Box */}
              {activeWard.department !== "CRECHE" && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                        activeWard.reportCard?.published
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {activeWard.reportCard?.published ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <Lock className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        Terminal Report Card (
                        {currentTerm?.termName || "Current Term"})
                      </h3>
                      {activeWard.reportCard?.published ? (
                        <p className="text-xs text-slate-600 mt-0.5">
                          Approved &amp; Published by Headmaster
                          {activeWard.avgScore !== null
                            ? ` • Average: ${activeWard.avgScore}%`
                            : ""}
                          {activeWard.jhsAggregate
                            ? ` • BECE Aggregate: ${String(
                                activeWard.jhsAggregate
                              ).padStart(2, "0")}`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700 mt-0.5">
                          Awaiting Headmaster approval before publication.
                        </p>
                      )}
                    </div>
                  </div>

                  {activeWard.reportCard?.published ? (
                    <Link
                      href={`/dashboard/report-cards/${activeWard.id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      View / Download PDF
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 text-xs font-bold shrink-0">
                      Pending Approval
                    </span>
                  )}
                </div>
              )}

              {/* Fee Statement & Payment History */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-700" />
                    <h3 className="font-bold text-slate-900">
                      Fee Statement &amp; Payment History (GH₵)
                    </h3>
                  </div>
                  {activeWard.balance > 0 ? (
                    <button
                      type="button"
                      onClick={() => openPayModal(activeWard)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold px-3 py-1.5 cursor-pointer"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Pay via Paystack
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Paid in Full
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Total Bill
                      </p>
                      <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                        {formatGHS(activeWard.billed)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                      <p className="text-[11px] font-semibold text-emerald-700">
                        Paid
                      </p>
                      <p className="text-sm sm:text-base font-extrabold text-emerald-800 mt-0.5">
                        {formatGHS(activeWard.paid)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                      <p className="text-[11px] font-semibold text-amber-700">
                        Balance
                      </p>
                      <p className="text-sm sm:text-base font-extrabold text-amber-900 mt-0.5">
                        {formatGHS(activeWard.balance)}
                      </p>
                    </div>
                  </div>

                  {/* Recent Receipts */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Payment Receipts
                    </p>
                    {!activeWard.recentReceipts ||
                    activeWard.recentReceipts.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No fee payments recorded for {activeWard.fullName} this
                        term.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {activeWard.recentReceipts.map((r) => (
                          <div
                            key={r.id}
                            className="p-3 flex items-center justify-between gap-2 text-xs bg-white"
                          >
                            <div>
                              <p className="font-mono font-bold text-slate-800">
                                {r.receiptNo} &bull;{" "}
                                <span className="font-sans font-semibold text-emerald-700">
                                  {formatGHS(r.amountPaid)}
                                </span>
                              </p>
                              <p className="text-slate-500 mt-0.5">
                                {r.paymentMethod === "MOMO" && r.momoNetwork
                                  ? MOMO_NETWORK_LABELS[r.momoNetwork]
                                  : PAYMENT_METHOD_LABELS[r.paymentMethod]}{" "}
                                &bull; {formatDate(r.paidAt)}
                              </p>
                            </div>
                            <Link
                              href={`/dashboard/finance/receipts/${r.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1.5 font-semibold shrink-0"
                            >
                              <Printer className="h-3.5 w-3.5" /> Receipt
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendance Records */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-emerald-700" />
                    <h3 className="font-bold text-slate-900">
                      Recent Attendance ({activeWard.attendanceRate ?? 100}%)
                    </h3>
                  </div>
                  <Link
                    href="/dashboard/attendance"
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Full Log &rarr;
                  </Link>
                </div>
                <div className="divide-y divide-slate-100">
                  {!activeWard.recentAttendance ||
                  activeWard.recentAttendance.length === 0 ? (
                    <p className="p-5 text-xs text-slate-500">
                      No attendance marked yet.
                    </p>
                  ) : (
                    activeWard.recentAttendance.map((a) => (
                      <div
                        key={a.id}
                        className="px-5 py-3 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">
                            {formatDate(a.date)}
                          </p>
                          {a.remarks && (
                            <p className="text-slate-500">{a.remarks}</p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            a.status === "PRESENT"
                              ? "bg-emerald-100 text-emerald-800"
                              : a.status === "LATE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Relevant School & Department Announcements */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden h-fit">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-emerald-700" />
                  <h3 className="font-bold text-slate-900">
                    School Notices
                  </h3>
                </div>
                <Link
                  href="/dashboard/announcements"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  All
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {wardAnnouncements.length === 0 ? (
                  <p className="p-5 text-xs text-slate-500">
                    No announcements for {activeWard.classroom} right now.
                  </p>
                ) : (
                  wardAnnouncements.map((a) => (
                    <div key={a.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 leading-snug">
                          {a.title}
                        </p>
                        {a.pinned && (
                          <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                        )}
                      </div>
                      {a.targetDepartment && a.targetDepartment !== "ALL" && (
                        <span className="inline-block mt-1 rounded bg-emerald-50 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                          {DEPARTMENT_LABELS[a.targetDepartment]}
                        </span>
                      )}
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        {a.content}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {formatDate(a.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Paystack MoMo / Card Checkout Modal */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title={`Pay Fees — ${activeWard?.fullName || ""}`}
        subtitle="Paystack Ghana Gateway (GHS — MTN MoMo, Telecel Cash, AT Money, or Visa/Mastercard)"
      >
        <form onSubmit={handlePaystackPay} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount to Pay (GH₵) *
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Channel
              </label>
              <select
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as "mobile_money" | "card")
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="mobile_money">Mobile Money (MoMo)</option>
                <option value="card">Visa / Mastercard</option>
              </select>
            </div>
          </div>

          {channel === "mobile_money" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  MoMo Network
                </label>
                <select
                  value={momoNetwork}
                  onChange={(e) =>
                    setMomoNetwork(e.target.value as "MTN" | "TELECEL" | "AT")
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="MTN">MTN Mobile Money</option>
                  <option value="TELECEL">Telecel Cash</option>
                  <option value="AT">AT Money</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  MoMo Phone (+233)
                </label>
                <input
                  required
                  value={momoPhone}
                  onChange={(e) => setMomoPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPayOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paying}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {paying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              Confirm Pay {payAmount ? formatGHS(Number(payAmount)) : ""}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
