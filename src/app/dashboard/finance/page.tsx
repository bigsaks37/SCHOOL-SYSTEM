"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Receipt,
  Trash2,
  Pencil,
  Loader2,
  Wallet,
  CreditCard,
  ListChecks,
  Search,
  AlertTriangle,
  Printer,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { ToastBanner, type ToastMessage } from "@/components/Toast";
import {
  formatGHS,
  formatDate,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  MOMO_NETWORK_LABELS,
  FEE_CATEGORY_LABELS,
  type DepartmentKey,
} from "@/lib/format";
import type { UserRole } from "@/lib/rbac";

type FeeCategory =
  | "TUITION"
  | "FEEDING"
  | "TRANSPORT"
  | "PTA"
  | "BOOKS"
  | "OTHER";

interface TermItem {
  id: string;
  academicYear: string;
  termName: string;
  isCurrent: boolean;
}

interface ClassroomOption {
  id: string;
  name: string;
  department: DepartmentKey;
}

interface FeeStructureItem {
  id: string;
  title: string;
  category: FeeCategory;
  amount: number;
  department: "ALL" | DepartmentKey;
  classroomId: string | null;
  classroom?: { id: string; name: string; department: string } | null;
}

interface LedgerRow {
  studentId: string;
  admissionNo: string;
  fullName: string;
  classroomId: string | null;
  classroom: string;
  department: string;
  parentName: string;
  parentPhone: string;
  totalBilled: number;
  totalPaid: number;
  balance: number;
  feeStatus: "PAID" | "PARTIAL" | "OWING";
  breakdown: FeeStructureItem[];
}

interface PaymentRow {
  id: string;
  receiptNo: string;
  amountPaid: number;
  paymentMethod: "MOMO" | "CASH" | "BANK_TRANSFER";
  momoNetwork: "MTN" | "TELECEL" | "AT" | null;
  channel: string;
  feeItemLabel: string | null;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  student: {
    admissionNo: string;
    firstName: string;
    lastName: string;
    classroom: { name: string } | null;
  };
  recordedBy: { fullName: string } | null;
}

type FinanceTab = "quick-pay" | "debtors" | "ledger" | "receipts" | "structures";

function FinanceInner() {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab") as FinanceTab | null;

  const [role, setRole] = useState<UserRole | null>(null);
  const [tab, setTab] = useState<FinanceTab>(initialTabParam || "quick-pay");
  const [terms, setTerms] = useState<TermItem[]>([]);
  const [termId, setTermId] = useState("");
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [structures, setStructures] = useState<FeeStructureItem[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totals, setTotals] = useState({
    expected: 0,
    collected: 0,
    arrears: 0,
    todayCollections: 0,
    todayReceiptsCount: 0,
    debtorsCount: 0,
  });
  const [paystackMode, setPaystackMode] = useState<"LIVE" | "SIMULATION">(
    "SIMULATION"
  );
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [lastIssuedReceipt, setLastIssuedReceipt] = useState<{
    id: string;
    receiptNo: string;
    amountPaid: number;
    studentName: string;
  } | null>(null);

  // Quick Payment search & form
  const [quickSearch, setQuickSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [payForm, setPayForm] = useState({
    amountPaid: "",
    paymentMethod: "MOMO" as "MOMO" | "CASH" | "BANK_TRANSFER",
    momoNetwork: "MTN" as "MTN" | "TELECEL" | "AT",
    feeItemLabel: "Term School Fees Payment",
    reference: "",
    notes: "",
  });
  const [savingPay, setSavingPay] = useState(false);

  // Debtors filters
  const [debtorDept, setDebtorDept] = useState("ALL");
  const [debtorClass, setDebtorClass] = useState("ALL");
  const [debtorStatus, setDebtorStatus] = useState<"ALL" | "OWING" | "PARTIAL">(
    "ALL"
  );
  const [debtorSearch, setDebtorSearch] = useState("");

  // Fee Structure Modal (Create & Edit)
  const [feeOpen, setFeeOpen] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState({
    title: "",
    category: "TUITION" as FeeCategory,
    amount: "",
    department: "ALL" as "ALL" | DepartmentKey,
    classroomId: "",
  });
  const [savingFee, setSavingFee] = useState(false);

  // Paystack Simulation Modal
  const [paystackOpen, setPaystackOpen] = useState(false);
  const [paystackForm, setPaystackForm] = useState({
    studentId: "",
    amountGhs: "",
    channelPreference: "mobile_money" as "mobile_money" | "card",
    momoNetwork: "MTN" as "MTN" | "TELECEL" | "AT",
    momoPhone: "+233 24 ",
    feeItemLabel: "Online Term Fees Payment (Paystack)",
  });
  const [processingPaystack, setProcessingPaystack] = useState(false);

  const loadFinance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (termId) params.set("termId", termId);

      const [meRes, res] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/finance/payments?${params.toString()}`),
      ]);
      const meJson = await meRes.json();
      const data = await res.json();
      const userRole: UserRole | null = meJson.user?.role || null;
      if (userRole) {
        setRole(userRole);
        if (userRole === "PARENT" && (tab === "quick-pay" || tab === "debtors")) {
          setTab("ledger");
        }
      }
      if (res.ok) {
        setTerms(data.terms || []);
        if (!termId && data.activeTermId) setTermId(data.activeTermId);
        setClassrooms(data.classrooms || []);
        setStructures(data.structures || []);
        setLedger(data.ledger || []);
        setPayments(data.payments || []);
        setTotals(
          data.totals || {
            expected: 0,
            collected: 0,
            arrears: 0,
            todayCollections: 0,
            todayReceiptsCount: 0,
            debtorsCount: 0,
          }
        );
        if (data.paystack?.mode) setPaystackMode(data.paystack.mode);
      } else {
        setToast({
          type: "error",
          text: data.error || "Failed to load finance data.",
        });
      }
    } catch {
      setToast({ type: "error", text: "Network error loading finance module." });
    } finally {
      setLoading(false);
    }
  }, [tab, termId]);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  const selectedStudent =
    ledger.find((l) => l.studentId === selectedStudentId) || null;

  function selectStudentForQuickPay(row: LedgerRow) {
    setSelectedStudentId(row.studentId);
    setPayForm({
      amountPaid: row.balance > 0 ? String(row.balance) : "",
      paymentMethod: "MOMO",
      momoNetwork: "MTN",
      feeItemLabel:
        row.balance > 0
          ? "Term School Fees Settlement"
          : "Advance / Extra Fee Payment",
      reference: "",
      notes: "",
    });
    setTab("quick-pay");
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    setSavingPay(true);
    setToast(null);
    try {
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.studentId,
          termId,
          amountPaid: Number(payForm.amountPaid),
          paymentMethod: payForm.paymentMethod,
          momoNetwork:
            payForm.paymentMethod === "MOMO" ? payForm.momoNetwork : null,
          feeItemLabel: payForm.feeItemLabel,
          reference: payForm.reference,
          notes: payForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Failed to record payment.",
        });
      } else {
        setLastIssuedReceipt({
          id: data.payment.id,
          receiptNo: data.payment.receiptNo,
          amountPaid: data.payment.amountPaid,
          studentName: selectedStudent.fullName,
        });
        setToast({
          type: "success",
          text: `Official Receipt ${data.payment.receiptNo} issued for ${formatGHS(data.payment.amountPaid)}.`,
        });
        setPayForm((p) => ({ ...p, amountPaid: "", reference: "", notes: "" }));
        await loadFinance();
      }
    } finally {
      setSavingPay(false);
    }
  }

  function openPaystackModal(row?: LedgerRow) {
    const target = row || selectedStudent || ledger[0];
    setPaystackForm({
      studentId: target?.studentId || "",
      amountGhs: target && target.balance > 0 ? String(target.balance) : "500",
      channelPreference: "mobile_money",
      momoNetwork: "MTN",
      momoPhone:
        target?.parentPhone && target.parentPhone !== "—"
          ? target.parentPhone
          : "+233 24 000 0000",
      feeItemLabel: "Online Term Fees Payment (Paystack)",
    });
    setPaystackOpen(true);
  }

  async function handlePaystackSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProcessingPaystack(true);
    setToast(null);
    try {
      const res = await fetch("/api/finance/paystack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...paystackForm,
          amountGhs: Number(paystackForm.amountGhs),
          termId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Paystack checkout failed.",
        });
      } else if (data.mode === "LIVE" && data.authorizationUrl) {
        window.open(data.authorizationUrl, "_blank", "noopener,noreferrer");
        setPaystackOpen(false);
        setToast({
          type: "success",
          text: `Redirected to Paystack checkout (Ref: ${data.reference}).`,
        });
      } else {
        setPaystackOpen(false);
        const stu = ledger.find((l) => l.studentId === paystackForm.studentId);
        setLastIssuedReceipt({
          id: data.payment.id,
          receiptNo: data.payment.receiptNo,
          amountPaid: data.payment.amountPaid,
          studentName: stu?.fullName || "Student",
        });
        setToast({
          type: "success",
          text: `${data.message} — Receipt ${data.payment.receiptNo} generated!`,
        });
        await loadFinance();
      }
    } finally {
      setProcessingPaystack(false);
    }
  }

  async function handleVoidPayment(p: PaymentRow) {
    if (!confirm(`Void receipt ${p.receiptNo} (${formatGHS(p.amountPaid)})?`)) {
      return;
    }
    const res = await fetch(`/api/finance/payments/${p.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setToast({ type: "success", text: `Voided receipt ${p.receiptNo}.` });
      await loadFinance();
    } else {
      const d = await res.json();
      setToast({ type: "error", text: d.error || "Failed to void receipt." });
    }
  }

  function openCreateFeeModal() {
    setEditingFeeId(null);
    setFeeForm({
      title: "",
      category: "TUITION",
      amount: "",
      department: "ALL",
      classroomId: "",
    });
    setFeeOpen(true);
  }

  function openEditFeeModal(s: FeeStructureItem) {
    setEditingFeeId(s.id);
    setFeeForm({
      title: s.title,
      category: s.category,
      amount: String(s.amount),
      department: s.department,
      classroomId: s.classroomId || "",
    });
    setFeeOpen(true);
  }

  async function handleSaveFeeStructure(e: React.FormEvent) {
    e.preventDefault();
    setSavingFee(true);
    setToast(null);
    try {
      const url = editingFeeId
        ? `/api/finance/structures/${editingFeeId}`
        : "/api/finance/structures";
      const method = editingFeeId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: feeForm.title,
          category: feeForm.category,
          amount: Number(feeForm.amount),
          department: feeForm.department,
          classroomId: feeForm.classroomId || null,
          termId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          type: "error",
          text: data.error || "Failed to save fee item.",
        });
      } else {
        setFeeOpen(false);
        setToast({
          type: "success",
          text: editingFeeId
            ? `Updated fee item "${data.structure.title}".`
            : `Added fee item "${data.structure.title}" — bills updated automatically.`,
        });
        await loadFinance();
      }
    } finally {
      setSavingFee(false);
    }
  }

  async function handleDeleteStructure(s: FeeStructureItem) {
    if (
      !confirm(
        `Delete fee item "${s.title}"? Student balances will recalculate immediately.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/finance/structures/${s.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setToast({ type: "success", text: `Deleted fee item "${s.title}".` });
      await loadFinance();
    } else {
      const d = await res.json();
      setToast({ type: "error", text: d.error || "Delete failed." });
    }
  }

  const canManage = role === "SUPER_ADMIN" || role === "BURSAR";

  // Filtered quick-search student matches
  const quickMatches = quickSearch.trim()
    ? ledger.filter((r) =>
        `${r.fullName} ${r.admissionNo} ${r.classroom} ${r.parentPhone}`
          .toLowerCase()
          .includes(quickSearch.trim().toLowerCase())
      )
    : ledger;

  // Filtered debtors list
  const debtors = ledger.filter((row) => {
    if (row.balance <= 0) return false;
    if (debtorDept !== "ALL" && row.department !== debtorDept) return false;
    if (debtorClass !== "ALL" && row.classroomId !== debtorClass) return false;
    if (debtorStatus !== "ALL" && row.feeStatus !== debtorStatus) return false;
    if (
      debtorSearch.trim() &&
      !`${row.fullName} ${row.admissionNo} ${row.parentName} ${row.parentPhone}`
        .toLowerCase()
        .includes(debtorSearch.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredDebtorTotal = debtors.reduce((s, d) => s + d.balance, 0);

  return (
    <div className="space-y-5">
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

      {/* Instant Printable Receipt Banner right after recording a payment */}
      {lastIssuedReceipt && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-950">
                Receipt {lastIssuedReceipt.receiptNo} Ready —{" "}
                {formatGHS(lastIssuedReceipt.amountPaid)}
              </p>
              <p className="text-xs text-emerald-800">
                Recorded for {lastIssuedReceipt.studentName}. Remaining balance
                has been updated automatically.
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/finance/receipts/${lastIssuedReceipt.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 shrink-0"
          >
            <Printer className="h-4 w-4" />
            Print Official Receipt
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {role === "PARENT"
              ? "School Fees, Paystack MoMo & Receipts (GH₵)"
              : "Accountant / Bursar Portal — School Fees (GH₵)"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            {role === "PARENT"
              ? "Check your ward's itemized term bill, pay via Paystack MoMo/Card, and print Official Receipts."
              : "Manage department fee structures, record full/partial payments, print official receipts, and track debtors."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openPaystackModal()}
            disabled={ledger.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs sm:text-sm font-semibold px-3.5 py-2.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Smartphone className="h-4 w-4" />
            Pay with MoMo / Card
          </button>
          {canManage && (
            <button
              type="button"
              onClick={openCreateFeeModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-3.5 py-2.5 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Fee Item
            </button>
          )}
        </div>
      </div>

      {/* 4 Financial Summary Cards in GHS (₵) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">
            {role === "PARENT" ? "Total Term Bill" : "Total Expected Fees"}
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {formatGHS(totals.expected)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {ledger.length} student(s) billed
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">
            Total Collected
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1">
            {formatGHS(totals.collected)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {totals.expected > 0
              ? `${Math.round((totals.collected / totals.expected) * 100)}% settled`
              : "0% settled"}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">
            Total Arrears (Owing)
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-amber-600 mt-1">
            {formatGHS(totals.arrears)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {totals.debtorsCount} student(s) owing
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-xs font-semibold text-slate-500">
            Today&apos;s Collections
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-sky-700 mt-1">
            {formatGHS(totals.todayCollections)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {totals.todayReceiptsCount} receipt(s) today
          </p>
        </div>
      </div>

      {/* Term & Navigation Tabs Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 bg-slate-200/70 p-1 rounded-xl">
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setTab("quick-pay")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  tab === "quick-pay"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CreditCard className="h-4 w-4" />
                Quick Payment
              </button>
              <button
                type="button"
                onClick={() => setTab("debtors")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  tab === "debtors"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Debtors ({totals.debtorsCount})
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setTab("ledger")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === "ledger"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Wallet className="h-4 w-4" />
            {role === "PARENT" ? "My Wards Fees" : "All Balances"}
          </button>
          <button
            type="button"
            onClick={() => setTab("receipts")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === "receipts"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Receipt className="h-4 w-4" />
            Receipts ({payments.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("structures")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === "structures"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ListChecks className="h-4 w-4" />
            Fee Structures
          </button>
        </div>

        <select
          value={termId}
          onChange={(e) => setTermId(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.academicYear} — {t.termName} {t.isCurrent ? "(Active)" : ""}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
          <span className="text-sm">Calculating GH₵ fee balances...</span>
        </div>
      ) : tab === "quick-pay" && canManage ? (
        /* QUICK PAYMENT & PART-PAYMENT WORKSPACE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Fast Student Search Picker */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 space-y-2.5">
              <h3 className="font-bold text-slate-900 text-sm">
                1. Search Student by Name or ID
              </h3>
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Type name or Student ID (e.g. SPS-2026-001)..."
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {quickMatches.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  No students match &ldquo;{quickSearch}&rdquo;.
                </p>
              ) : (
                quickMatches.map((row) => {
                  const active = row.studentId === selectedStudentId;
                  return (
                    <button
                      key={row.studentId}
                      type="button"
                      onClick={() => selectStudentForQuickPay(row)}
                      className={`w-full text-left p-3.5 flex items-center justify-between gap-2 transition cursor-pointer ${
                        active
                          ? "bg-emerald-50 border-l-4 border-emerald-700"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate">
                          {row.fullName}
                        </p>
                        <p className="text-xs text-slate-500 font-mono truncate">
                          {row.admissionNo} &bull; {row.classroom}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs font-extrabold ${
                            row.balance > 0
                              ? "text-amber-700"
                              : "text-emerald-700"
                          }`}
                        >
                          {row.balance > 0
                            ? `Owes ${formatGHS(row.balance)}`
                            : "Paid Full"}
                        </p>
                        <StatusPill status={row.feeStatus} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Balance Breakdown & Payment Form */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            {!selectedStudent ? (
              <div className="py-16 text-center">
                <CreditCard className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="mt-3 text-sm font-bold text-slate-700">
                  Select a student on the left to record a fee payment
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  View their itemized term bill, accept full or partial
                  payments, and print an official GH₵ receipt.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Student Financial Header */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-base text-slate-900">
                        {selectedStudent.fullName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedStudent.admissionNo} &bull;{" "}
                        <strong>{selectedStudent.classroom}</strong> (
                        {DEPARTMENT_LABELS[selectedStudent.department]})
                      </p>
                    </div>
                    <StatusPill status={selectedStudent.feeStatus} />
                  </div>

                  {/* Itemized Bill Mini-List */}
                  <div className="border-t border-slate-200/80 pt-2.5 space-y-1 text-xs">
                    {selectedStudent.breakdown.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-slate-600"
                      >
                        <span>
                          {item.title}{" "}
                          <span className="text-[10px] text-slate-400">
                            ({FEE_CATEGORY_LABELS[item.category] || item.category})
                          </span>
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatGHS(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-200/80 text-center">
                    <div className="rounded-lg bg-white border border-slate-200 py-2">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">
                        Total Bill
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-slate-900">
                        {formatGHS(selectedStudent.totalBilled)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 py-2">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">
                        Paid
                      </p>
                      <p className="text-xs sm:text-sm font-bold text-emerald-700">
                        {formatGHS(selectedStudent.totalPaid)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-200 py-2">
                      <p className="text-[10px] font-semibold uppercase text-amber-700">
                        Remaining
                      </p>
                      <p className="text-xs sm:text-sm font-extrabold text-amber-900">
                        {formatGHS(selectedStudent.balance)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Recording Form */}
                <form onSubmit={handleRecordPayment} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Amount Paying Now (GH₵) *
                        </label>
                        {selectedStudent.balance > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPayForm({
                                ...payForm,
                                amountPaid: String(selectedStudent.balance),
                              })
                            }
                            className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                          >
                            Fill Full Balance
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={payForm.amountPaid}
                        onChange={(e) =>
                          setPayForm({ ...payForm, amountPaid: e.target.value })
                        }
                        placeholder="Enter full or partial amount..."
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Payment Method *
                      </label>
                      <select
                        value={payForm.paymentMethod}
                        onChange={(e) =>
                          setPayForm({
                            ...payForm,
                            paymentMethod: e.target.value as
                              | "MOMO"
                              | "CASH"
                              | "BANK_TRANSFER",
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                      >
                        <option value="MOMO">
                          Mobile Money (MTN / Telecel / AT)
                        </option>
                        <option value="CASH">Cash (Accounts Office)</option>
                        <option value="BANK_TRANSFER">
                          Bank Transfer / Deposit Slip
                        </option>
                      </select>
                    </div>
                  </div>

                  {payForm.paymentMethod === "MOMO" && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Ghana Mobile Money Network
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["MTN", "TELECEL", "AT"] as const).map((net) => (
                          <button
                            key={net}
                            type="button"
                            onClick={() =>
                              setPayForm({ ...payForm, momoNetwork: net })
                            }
                            className={`rounded-xl border py-2 text-xs font-bold cursor-pointer transition ${
                              payForm.momoNetwork === net
                                ? "bg-amber-400 text-emerald-950 border-amber-500"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {MOMO_NETWORK_LABELS[net]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Itemized Payment Description
                      </label>
                      <input
                        value={payForm.feeItemLabel}
                        onChange={(e) =>
                          setPayForm({
                            ...payForm,
                            feeItemLabel: e.target.value,
                          })
                        }
                        placeholder="e.g. Tuition & Feeding Fee (Part Payment)"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Transaction Ref / Slip No.
                      </label>
                      <input
                        value={payForm.reference}
                        onChange={(e) =>
                          setPayForm({ ...payForm, reference: e.target.value })
                        }
                        placeholder="e.g. MTN-90128832 or GCB-441"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openPaystackModal(selectedStudent)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold px-3.5 py-2.5 cursor-pointer"
                    >
                      <Smartphone className="h-4 w-4" />
                      Simulate Paystack Checkout
                    </button>
                    <button
                      type="submit"
                      disabled={savingPay}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-5 py-2.5 shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      {savingPay && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Record Payment &amp; Issue Receipt
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : tab === "debtors" && canManage ? (
        /* FILTERABLE DEBTORS LIST */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={debtorDept}
              onChange={(e) => {
                setDebtorDept(e.target.value);
                setDebtorClass("ALL");
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="ALL">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            <select
              value={debtorClass}
              onChange={(e) => setDebtorClass(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="ALL">All Classes</option>
              {classrooms
                .filter(
                  (c) => debtorDept === "ALL" || c.department === debtorDept
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <select
              value={debtorStatus}
              onChange={(e) =>
                setDebtorStatus(e.target.value as "ALL" | "OWING" | "PARTIAL")
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="ALL">Owing &amp; Partial</option>
              <option value="OWING">Owing (0 Paid)</option>
              <option value="PARTIAL">Partial Payment</option>
            </select>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={debtorSearch}
                onChange={(e) => setDebtorSearch(e.target.value)}
                placeholder="Search debtor or phone..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between text-xs sm:text-sm">
            <span className="font-semibold text-amber-950">
              Showing <strong>{debtors.length}</strong> student(s) with unpaid
              balances
            </span>
            <span className="font-extrabold text-amber-900">
              Filtered Arrears: {formatGHS(filteredDebtorTotal)}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Guardian Contact</th>
                    <th className="px-4 py-3 font-semibold text-right">Paid</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Balance Owing
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debtors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No debtors match this filter.
                      </td>
                    </tr>
                  ) : (
                    debtors.map((row) => (
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
                            {row.classroom}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {DEPARTMENT_LABELS[row.department]}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p className="font-medium text-slate-800">
                            {row.parentName}
                          </p>
                          <p className="text-slate-500">{row.parentPhone}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
                          {formatGHS(row.totalPaid)}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-red-700">
                          {formatGHS(row.balance)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusPill status={row.feeStatus} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => selectStudentForQuickPay(row)}
                            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
                          >
                            Collect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : tab === "ledger" ? (
        /* ALL STUDENT BALANCES / PARENT WARD FEES */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold text-right">Billed</th>
                  <th className="px-4 py-3 font-semibold text-right">Paid</th>
                  <th className="px-4 py-3 font-semibold text-right">Balance</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((row) => (
                  <tr key={row.studentId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {row.fullName}
                      </p>
                      <p className="text-xs font-mono text-slate-500">
                        {row.admissionNo}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.classroom}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatGHS(row.totalBilled)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {formatGHS(row.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatGHS(row.balance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill status={row.feeStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => selectStudentForQuickPay(row)}
                            className="rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                          >
                            Record Pay
                          </button>
                        ) : (
                          row.balance > 0 && (
                            <button
                              type="button"
                              onClick={() => openPaystackModal(row)}
                              className="rounded-lg bg-sky-700 hover:bg-sky-800 text-white px-3 py-1.5 text-xs font-semibold cursor-pointer"
                            >
                              Pay MoMo/Card
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "receipts" ? (
        /* RECEIPTS LIST WITH PRINTABLE RECEIPT LINKS */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Receipt No.</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Method &amp; Ref</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No payment receipts recorded for this term.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">
                        {p.receiptNo}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {p.student.firstName} {p.student.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.student.classroom?.name || "—"} &bull;{" "}
                          {p.feeItemLabel || "School Fees"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold text-slate-700">
                          {p.paymentMethod === "MOMO" && p.momoNetwork
                            ? MOMO_NETWORK_LABELS[p.momoNetwork]
                            : PAYMENT_METHOD_LABELS[p.paymentMethod]}
                          {p.channel === "PAYSTACK_SIMULATION" && (
                            <span className="ml-1.5 rounded bg-sky-100 text-sky-800 px-1.5 py-0.5 text-[10px]">
                              Paystack
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {p.reference || p.notes || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatDate(p.paidAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {formatGHS(p.amountPaid)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/dashboard/finance/receipts/${p.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2.5 py-1.5 text-xs font-semibold"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Receipt
                          </Link>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleVoidPayment(p)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                              title="Void receipt"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ITEMIZED DEPARTMENT & CLASS FEE STRUCTURES */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Itemized Fee</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">
                    Department / Class
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Amount (GH₵)
                  </th>
                  {canManage && (
                    <th className="px-4 py-3 font-semibold text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {structures.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {s.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {FEE_CATEGORY_LABELS[s.category] || s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600">
                      {s.classroom
                        ? `${s.classroom.name} (${DEPARTMENT_LABELS[s.department]})`
                        : DEPARTMENT_LABELS[s.department] || s.department}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatGHS(s.amount)}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditFeeModal(s)}
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            title="Edit fee item"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStructure(s)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                            title="Delete fee item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Itemized Fee Structure Modal */}
      <Modal
        open={feeOpen}
        onClose={() => setFeeOpen(false)}
        title={editingFeeId ? "Edit Fee Structure Item" : "Add Itemized Term Bill"}
        subtitle="Automatically assigns this bill to every student in the selected department or class."
      >
        <form onSubmit={handleSaveFeeStructure} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fee Title *
            </label>
            <input
              required
              value={feeForm.title}
              onChange={(e) =>
                setFeeForm({ ...feeForm, title: e.target.value })
              }
              placeholder="e.g. Creche Feeding Fee, School Bus Levy, BECE Registration"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={feeForm.category}
                onChange={(e) =>
                  setFeeForm({
                    ...feeForm,
                    category: e.target.value as FeeCategory,
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="TUITION">Tuition</option>
                <option value="FEEDING">Feeding Fee</option>
                <option value="TRANSPORT">Transport / Bus</option>
                <option value="PTA">PTA Dues</option>
                <option value="BOOKS">Books / Stationery</option>
                <option value="OTHER">Other Levy</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (GH₵) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={feeForm.amount}
                onChange={(e) =>
                  setFeeForm({ ...feeForm, amount: e.target.value })
                }
                placeholder="e.g. 450"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Department *
              </label>
              <select
                value={feeForm.department}
                onChange={(e) =>
                  setFeeForm({
                    ...feeForm,
                    department: e.target.value as "ALL" | DepartmentKey,
                    classroomId: "",
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="ALL">All Departments</option>
                <option value="CRECHE">Creche / Daycare</option>
                <option value="KINDERGARTEN">Kindergarten (KG 1 &amp; KG 2)</option>
                <option value="PRIMARY">Primary (Basic 1–6)</option>
                <option value="JHS">Junior High School (JHS 1–3)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specific Class (Optional)
              </label>
              <select
                value={feeForm.classroomId}
                onChange={(e) =>
                  setFeeForm({ ...feeForm, classroomId: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Entire Department --</option>
                {classrooms
                  .filter(
                    (c) =>
                      feeForm.department === "ALL" ||
                      c.department === feeForm.department
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} Only
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setFeeOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingFee}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {savingFee && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingFeeId ? "Update Fee Item" : "Save Fee Item"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Paystack Ghana Online Payment Simulation Modal */}
      <Modal
        open={paystackOpen}
        onClose={() => setPaystackOpen(false)}
        title="Pay with MoMo / Card — Paystack Ghana"
        subtitle={
          paystackMode === "LIVE"
            ? "Live Paystack Ghana gateway active (GHS)"
            : "Simulation Mode active — add live PAYSTACK_PUBLIC_KEY & PAYSTACK_SECRET_KEY in .env to switch to live checkout"
        }
      >
        <form onSubmit={handlePaystackSubmit} className="space-y-4">
          <div className="rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-2.5 flex items-center gap-2 text-xs text-sky-900">
            <ShieldCheck className="h-4 w-4 text-sky-700 shrink-0" />
            <span>
              Paystack Gateway Status:{" "}
              <strong>
                {paystackMode === "LIVE" ? "LIVE" : "READY (SIMULATION MODE)"}
              </strong>{" "}
              &bull; Currency: <strong>GHS (₵)</strong>
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Student *
            </label>
            <select
              required
              value={paystackForm.studentId}
              onChange={(e) => {
                const st = ledger.find((l) => l.studentId === e.target.value);
                setPaystackForm({
                  ...paystackForm,
                  studentId: e.target.value,
                  amountGhs:
                    st && st.balance > 0 ? String(st.balance) : paystackForm.amountGhs,
                });
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {ledger.map((row) => (
                <option key={row.studentId} value={row.studentId}>
                  {row.fullName} ({row.classroom}) — Bal:{" "}
                  {formatGHS(row.balance)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (GH₵) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={paystackForm.amountGhs}
                onChange={(e) =>
                  setPaystackForm({
                    ...paystackForm,
                    amountGhs: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Paystack Channel *
              </label>
              <select
                value={paystackForm.channelPreference}
                onChange={(e) =>
                  setPaystackForm({
                    ...paystackForm,
                    channelPreference: e.target.value as
                      | "mobile_money"
                      | "card",
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="mobile_money">
                  Mobile Money (MTN / Telecel / AT)
                </option>
                <option value="card">Visa / Mastercard</option>
              </select>
            </div>
          </div>

          {paystackForm.channelPreference === "mobile_money" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  MoMo Network
                </label>
                <select
                  value={paystackForm.momoNetwork}
                  onChange={(e) =>
                    setPaystackForm({
                      ...paystackForm,
                      momoNetwork: e.target.value as "MTN" | "TELECEL" | "AT",
                    })
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
                  MoMo Number (+233)
                </label>
                <input
                  value={paystackForm.momoPhone}
                  onChange={(e) =>
                    setPaystackForm({
                      ...paystackForm,
                      momoPhone: e.target.value,
                    })
                  }
                  placeholder="+233 24 XXX XXXX"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPaystackOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processingPaystack}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white px-5 py-2 text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {processingPaystack ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              Pay {paystackForm.amountGhs ? formatGHS(Number(paystackForm.amountGhs)) : ""}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StatusPill({ status }: { status: "PAID" | "PARTIAL" | "OWING" }) {
  const styles = {
    PAID: "bg-emerald-100 text-emerald-800",
    PARTIAL: "bg-amber-100 text-amber-800",
    OWING: "bg-red-100 text-red-700",
  }[status];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${styles}`}
    >
      {status}
    </span>
  );
}

export default function FinancePage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 flex items-center justify-center text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        </div>
      }
    >
      <FinanceInner />
    </Suspense>
  );
}
