export function formatGHS(amount: number): string {
  return `GH₵ ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function computeGesGrade(total: number): {
  grade: string;
  remarks: string;
} {
  if (total >= 80) return { grade: "1", remarks: "Highest" };
  if (total >= 70) return { grade: "2", remarks: "Higher" };
  if (total >= 65) return { grade: "3", remarks: "High" };
  if (total >= 60) return { grade: "4", remarks: "High Average" };
  if (total >= 55) return { grade: "5", remarks: "Average" };
  if (total >= 50) return { grade: "6", remarks: "Low Average" };
  if (total >= 45) return { grade: "7", remarks: "Low" };
  if (total >= 40) return { grade: "8", remarks: "Lower" };
  return { grade: "9", remarks: "Lowest" };
}

export type DepartmentKey = "CRECHE" | "KINDERGARTEN" | "PRIMARY" | "JHS";

export const DEPARTMENTS: Array<{
  key: DepartmentKey;
  label: string;
  shortLabel: string;
  range: string;
  badgeClass: string;
  barClass: string;
}> = [
  {
    key: "CRECHE",
    label: "Creche / Daycare",
    shortLabel: "Creche",
    range: "Creche & Nursery 1–2",
    badgeClass: "bg-pink-50 text-pink-700 border-pink-200",
    barClass: "bg-pink-500",
  },
  {
    key: "KINDERGARTEN",
    label: "Kindergarten",
    shortLabel: "KG",
    range: "KG 1 & KG 2",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    barClass: "bg-amber-500",
  },
  {
    key: "PRIMARY",
    label: "Primary",
    shortLabel: "Primary",
    range: "Basic 1 – Basic 6",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    barClass: "bg-emerald-600",
  },
  {
    key: "JHS",
    label: "Junior High School",
    shortLabel: "JHS",
    range: "JHS 1 – JHS 3",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
    barClass: "bg-sky-600",
  },
];

export const DEPARTMENT_LABELS: Record<string, string> = {
  CRECHE: "Creche / Daycare",
  KINDERGARTEN: "Kindergarten (KG 1–2)",
  PRIMARY: "Primary (Basic 1–6)",
  JHS: "Junior High (JHS 1–3)",
  ALL: "All Departments",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MOMO: "Mobile Money (MoMo)",
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
};

export const MOMO_NETWORK_LABELS: Record<string, string> = {
  MTN: "MTN MoMo",
  TELECEL: "Telecel Cash",
  AT: "AT Money",
};

export const FEE_CATEGORY_LABELS: Record<string, string> = {
  TUITION: "Tuition",
  FEEDING: "Feeding Fee",
  TRANSPORT: "Transport / Bus",
  PTA: "PTA Dues",
  BOOKS: "Books / Stationery",
  OTHER: "Other Levy",
};

export const GHANA_BASIC_SUBJECTS = [
  "Mathematics",
  "English Language",
  "Integrated Science",
  "Social Studies",
  "Our World Our People",
  "Computing (ICT)",
  "Religious & Moral Education",
  "Ghanaian Language (Twi/Ga)",
  "Creative Arts & Design",
  "Career Technology",
  "French",
  "Early Years Literacy",
  "Numeracy",
];

export const FEEDING_STATUS_LABELS: Record<string, string> = {
  ATE_ALL: "Ate All",
  ATE_HALF: "Ate Half",
  REFUSED: "Refused",
  NOT_APPLICABLE: "N/A",
};

export const SLEEP_QUALITY_LABELS: Record<string, string> = {
  PEACEFUL: "Peaceful",
  LIGHT: "Light Sleep",
  RESTLESS: "Restless",
  NO_NAP: "Did Not Nap",
};

export const MOOD_LABELS: Record<string, string> = {
  HAPPY: "Happy & Active",
  CALM: "Calm",
  TIRED: "Tired",
  FUSSY: "Fussy",
  UNWELL: "Unwell / Monitor",
};

