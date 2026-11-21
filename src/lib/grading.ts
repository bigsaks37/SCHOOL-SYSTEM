export type MasteryRatingKey =
  | "EXCEEDING"
  | "MEETING"
  | "DEVELOPING"
  | "NEEDS_SUPPORT";

export const KG_MASTERY_RATINGS: Array<{
  key: MasteryRatingKey;
  label: string;
  shortLabel: string;
  badgeClass: string;
  numericWeight: number;
}> = [
  {
    key: "EXCEEDING",
    label: "Exceeding Expectation",
    shortLabel: "Exceeding",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    numericWeight: 4,
  },
  {
    key: "MEETING",
    label: "Meeting Expectation",
    shortLabel: "Meeting",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-200",
    numericWeight: 3,
  },
  {
    key: "DEVELOPING",
    label: "Developing",
    shortLabel: "Developing",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    numericWeight: 2,
  },
  {
    key: "NEEDS_SUPPORT",
    label: "Needs Support",
    shortLabel: "Needs Support",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    numericWeight: 1,
  },
];

export const KG_MASTERY_MAP: Record<string, string> = {
  EXCEEDING: "Exceeding Expectation",
  MEETING: "Meeting Expectation",
  DEVELOPING: "Developing",
  NEEDS_SUPPORT: "Needs Support",
};

/**
 * Ghana WAEC / BECE 1–9 Grading Scale (JHS standard & optional for Primary)
 */
export function computeBeceGrade(total: number): {
  grade: string;
  numericGrade: number;
  remarks: string;
} {
  if (total >= 80) return { grade: "1", numericGrade: 1, remarks: "Highest" };
  if (total >= 70) return { grade: "2", numericGrade: 2, remarks: "Higher" };
  if (total >= 65) return { grade: "3", numericGrade: 3, remarks: "High" };
  if (total >= 60)
    return { grade: "4", numericGrade: 4, remarks: "High Average" };
  if (total >= 55) return { grade: "5", numericGrade: 5, remarks: "Average" };
  if (total >= 50)
    return { grade: "6", numericGrade: 6, remarks: "Low Average" };
  if (total >= 45) return { grade: "7", numericGrade: 7, remarks: "Low" };
  if (total >= 40) return { grade: "8", numericGrade: 8, remarks: "Lower" };
  return { grade: "9", numericGrade: 9, remarks: "Lowest" };
}

/**
 * Primary A–F Letter Grading Scale
 */
export function computePrimaryLetterGrade(total: number): {
  grade: string;
  remarks: string;
} {
  if (total >= 80) return { grade: "A", remarks: "Excellent" };
  if (total >= 70) return { grade: "B", remarks: "Very Good" };
  if (total >= 60) return { grade: "C", remarks: "Good" };
  if (total >= 50) return { grade: "D", remarks: "Credit" };
  if (total >= 40) return { grade: "E", remarks: "Pass" };
  return { grade: "F", remarks: "Needs Improvement" };
}

export function computeDepartmentGrade(
  total: number,
  department: string,
  primaryGradingScale: string = "LETTER"
): { grade: string; remarks: string } {
  if (department === "JHS" || primaryGradingScale === "BECE") {
    const bece = computeBeceGrade(total);
    return { grade: bece.grade, remarks: bece.remarks };
  }
  return computePrimaryLetterGrade(total);
}

export function formatOrdinal(n: number | null | undefined): string {
  if (!n || n <= 0) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Computes standard competition ranking (ties share rank: 1, 2, 2, 4).
 */
export function computeRankMap(
  entries: Array<{ id: string; score: number }>
): Map<string, number> {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const map = new Map<string, number>();
  let prevScore: number | null = null;
  let currentRank = 0;

  sorted.forEach((item, index) => {
    if (prevScore === null || item.score < prevScore) {
      currentRank = index + 1;
      prevScore = item.score;
    }
    map.set(item.id, currentRank);
  });

  return map;
}

const CORE_SUBJECT_KEYWORDS = [
  "english",
  "mathematics",
  "math",
  "integrated science",
  "science",
  "social studies",
];

export function isJhsCoreSubject(subjectName: string, category?: string): boolean {
  if (category === "CORE") return true;
  if (category === "ELECTIVE") return false;
  const lower = subjectName.toLowerCase();
  return CORE_SUBJECT_KEYWORDS.some((kw) => lower.includes(kw));
}

export interface JhsAggregateResult {
  aggregate: number | null;
  isComplete: boolean;
  coreCount: number;
  electiveCount: number;
  coresUsed: Array<{ subject: string; totalScore: number; grade: number }>;
  electivesUsed: Array<{ subject: string; totalScore: number; grade: number }>;
  note: string;
}

/**
 * Ghana BECE Aggregate Calculator for JHS:
 * 4 Core Subjects (English, Mathematics, Integrated Science, Social Studies)
 * + Best 2 Elective Subjects (lowest BECE grade numbers) = Aggregate (best 6, worst 54).
 */
export function calculateJhsBeceAggregate(
  assessments: Array<{
    subject: string;
    subjectCategory: string;
    totalScore: number;
  }>
): JhsAggregateResult {
  const cores: Array<{ subject: string; totalScore: number; grade: number }> = [];
  const electives: Array<{ subject: string; totalScore: number; grade: number }> = [];

  for (const a of assessments) {
    const bece = computeBeceGrade(a.totalScore);
    const entry = {
      subject: a.subject,
      totalScore: a.totalScore,
      grade: bece.numericGrade,
    };
    if (isJhsCoreSubject(a.subject, a.subjectCategory)) {
      cores.push(entry);
    } else {
      electives.push(entry);
    }
  }

  // Sort best first (lowest numeric BECE grade, tie-break by highest totalScore)
  const sortBest = (
    a: { grade: number; totalScore: number },
    b: { grade: number; totalScore: number }
  ) => a.grade - b.grade || b.totalScore - a.totalScore;

  const coresUsed = [...cores].sort(sortBest).slice(0, 4);
  const electivesUsed = [...electives].sort(sortBest).slice(0, 2);

  const isComplete = coresUsed.length === 4 && electivesUsed.length === 2;
  const selected = [...coresUsed, ...electivesUsed];
  const aggregate =
    selected.length > 0
      ? selected.reduce((sum, item) => sum + item.grade, 0)
      : null;

  let note = "";
  if (isComplete) {
    note = "4 Core + Best 2 Electives (Official BECE 6-Subject Aggregate)";
  } else {
    note = `Provisional (${coresUsed.length}/4 Core, ${electivesUsed.length}/2 Electives recorded)`;
  }

  return {
    aggregate,
    isComplete,
    coreCount: coresUsed.length,
    electiveCount: electivesUsed.length,
    coresUsed,
    electivesUsed,
    note,
  };
}
