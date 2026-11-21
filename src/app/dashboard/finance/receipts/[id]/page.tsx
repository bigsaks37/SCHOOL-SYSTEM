"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  GraduationCap,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  formatGHS,
  formatDate,
  DEPARTMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  MOMO_NETWORK_LABELS,
  FEE_CATEGORY_LABELS,
} from "@/lib/format";

interface ReceiptPayload {
  school: {
    schoolName: string;
    motto: string;
    address: string;
    phone: string;
    email: string;
    gesCode: string;
  } | null;
  payment: {
    id: string;
    receiptNo: string;
    paidAt: string;
    amountPaid: number;
    paymentMethod: string;
    momoNetwork: string | null;
    channel: string;
    feeItemLabel: string;
    reference: string | null;
    notes: string | null;
    recordedBy: string;
  };
  term: { academicYear: string; termName: string };
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
    classroomName: string;
    department: string;
    guardianName: string;
    guardianPhone: string;
  };
  itemizedBill: Array<{
    id: string;
    title: string;
    category: string;
    amount: number;
  }>;
  balances: {
    totalBilled: number;
    totalPaidToDate: number;
    remainingBalance: number;
    feeStatus: "PAID" | "PARTIAL" | "OWING";
  };
}

export default function OfficialFeeReceiptPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ReceiptPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/finance/payments/${params.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => active && setError("Failed to load official receipt."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
        <span className="text-sm">Loading Official Fee Receipt...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-red-200 p-8 text-center">
        <p className="text-sm font-semibold text-red-700">
          {error || "Receipt not found."}
        </p>
        <Link
          href="/dashboard/finance?tab=receipts"
          className="inline-block mt-3 text-sm font-semibold text-emerald-700 hover:underline"
        >
          &larr; Back to Finance
        </Link>
      </div>
    );
  }

  const methodDisplay =
    data.payment.paymentMethod === "MOMO" && data.payment.momoNetwork
      ? MOMO_NETWORK_LABELS[data.payment.momoNetwork]
      : PAYMENT_METHOD_LABELS[data.payment.paymentMethod] ||
        data.payment.paymentMethod;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Top Action Bar (Hidden when Printing) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200/80 p-3.5 flex items-center justify-between gap-3">
        <Link
          href="/dashboard/finance?tab=receipts"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Finance
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 shadow-xs cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          Print / Save Receipt as PDF
        </button>
      </div>

      {/* OFFICIAL FEE RECEIPT SHEET */}
      <div className="report-card-sheet bg-white rounded-2xl border-2 border-emerald-900/20 shadow-sm overflow-hidden">
        {/* School Header */}
        <div className="bg-emerald-900 text-white px-6 py-5 border-b-4 border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center shrink-0">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight">
                {data.school?.schoolName || "Sankofa Preparatory & JHS"}
              </h1>
              <p className="text-xs text-emerald-100">
                {data.school?.address} &bull; {data.school?.phone}
              </p>
              <p className="text-[11px] text-amber-300 font-semibold mt-0.5">
                GES Code: {data.school?.gesCode || "GES-GA-0419"}
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="inline-block rounded-lg bg-amber-400 text-emerald-950 px-3 py-1 text-xs font-black uppercase tracking-wider">
              Official Fee Receipt
            </span>
            <p className="font-mono text-sm font-bold text-white mt-1.5">
              {data.payment.receiptNo}
            </p>
            <p className="text-xs text-emerald-200">
              Date: {formatDate(data.payment.paidAt)}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Student & Payment Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Received From (Student)
              </span>
              <strong className="text-sm text-slate-900">
                {data.student.fullName}
              </strong>
              <span className="block font-mono text-[11px] text-slate-500">
                {data.student.admissionNo}
              </span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Class &amp; Department
              </span>
              <strong className="text-sm text-slate-900">
                {data.student.classroomName}
              </strong>
              <span className="block text-[11px] text-slate-500">
                {DEPARTMENT_LABELS[data.student.department] ||
                  data.student.department}
              </span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Academic Term
              </span>
              <strong className="text-sm text-slate-900">
                {data.term.academicYear}
              </strong>
              <span className="block text-[11px] text-slate-500">
                {data.term.termName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Parent / Guardian
              </span>
              <strong className="text-slate-900">
                {data.student.guardianName}
              </strong>
              <span className="block text-[11px] text-slate-500">
                {data.student.guardianPhone}
              </span>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Payment Method
              </span>
              <strong className="text-slate-900">{methodDisplay}</strong>
              {data.payment.channel === "PAYSTACK_SIMULATION" && (
                <span className="block text-[10px] font-semibold text-sky-700">
                  Via Paystack Ghana
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold block text-[10px]">
                Transaction Reference
              </span>
              <strong className="font-mono text-slate-900">
                {data.payment.reference || "Accounts Desk"}
              </strong>
            </div>
          </div>

          {/* Itemized Payment & Term Bill */}
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
              Itemized Payment Details
            </h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Description</th>
                    <th className="px-4 py-2.5 font-bold text-right">
                      Amount (GH₵)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-emerald-50/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">
                        {data.payment.feeItemLabel}
                      </p>
                      {data.payment.notes && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {data.payment.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-base font-black text-emerald-800">
                      {formatGHS(data.payment.amountPaid)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Term Bill Reference & Remaining Balance Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 space-y-1.5 text-xs">
              <p className="font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                Applicable Term Bill Breakdown
              </p>
              {data.itemizedBill.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between text-slate-600"
                >
                  <span>
                    {b.title} ({FEE_CATEGORY_LABELS[b.category] || b.category})
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatGHS(b.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-bold text-slate-900">
                <span>Total Term Bill</span>
                <span>{formatGHS(data.balances.totalBilled)}</span>
              </div>
            </div>

            <div className="rounded-xl border-2 border-emerald-800/20 bg-slate-50 p-4 flex flex-col justify-between gap-2 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Amount Paid (This Receipt)</span>
                  <strong className="text-sm text-emerald-800">
                    {formatGHS(data.payment.amountPaid)}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total Paid This Term</span>
                  <strong className="text-slate-900">
                    {formatGHS(data.balances.totalPaidToDate)}
                  </strong>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-900 uppercase">
                    Remaining Balance
                  </span>
                  <strong
                    className={`text-base font-black ${
                      data.balances.remainingBalance > 0
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {formatGHS(data.balances.remainingBalance)}
                  </strong>
                </div>
              </div>

              <div className="pt-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                    data.balances.feeStatus === "PAID"
                      ? "bg-emerald-100 text-emerald-800"
                      : data.balances.feeStatus === "PARTIAL"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Account Status:{" "}
                  {data.balances.feeStatus === "PAID"
                    ? "PAID IN FULL"
                    : data.balances.feeStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Accountant Signature & Official Stamp Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs">
            <div className="space-y-6">
              <p className="text-slate-500">
                Issued By: <strong className="text-slate-900">{data.payment.recordedBy}</strong>
              </p>
              <div>
                <div className="border-b border-slate-400 w-56 mb-1.5" />
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Accountant / Bursar Signature
                </p>
              </div>
            </div>

            <div className="rounded-xl border-2 border-dashed border-emerald-700/50 bg-emerald-50/40 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                  Accounts Office Verified
                </p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {data.school?.schoolName}
                </p>
                <p className="text-[10px] text-slate-500">
                  Receipt {data.payment.receiptNo} &bull; {formatDate(data.payment.paidAt)}
                </p>
              </div>
              <ShieldCheck className="h-8 w-8 text-emerald-700 shrink-0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
