import type { ContactSource, DonationType, PaymentMethod, PlanFrequency, PotentialStatus } from "@/lib/types";

const POTENTIAL_STATUS_LABELS: Record<PotentialStatus, string> = {
  new: "חדש",
  potential: "פוטנציאל",
  high: "גבוה",
  paid: "שילם",
  refused: "סירב",
  not_interested: "לא מעוניין",
};

const DONATION_TYPE_LABELS: Record<DonationType, string> = {
  one_time: "חד פעמי",
  recurring: "מחזורי",
};

const PLAN_FREQUENCY_LABELS: Record<PlanFrequency, string> = {
  monthly: "חודשי",
  yearly: "שנתי",
};

const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  manual: "ידני",
  browser_contacts: "אנשי קשר בדפדפן",
  csv: "קובץ CSV",
  vcf: "כרטיס VCF",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  credit: "אשראי",
  bank: "העברה בנקאית",
  nedarim_plus: "נדרים פלוס",
  other: "אחר",
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ["credit", "bank", "nedarim_plus", "other"];

export function formatPotentialStatus(status: PotentialStatus | null | undefined): string {
  if (!status) return "ללא סטטוס";
  return POTENTIAL_STATUS_LABELS[status] ?? status;
}

export function formatDonationType(type: DonationType): string {
  return DONATION_TYPE_LABELS[type] ?? type;
}

export function formatPlanFrequency(frequency: PlanFrequency): string {
  return PLAN_FREQUENCY_LABELS[frequency] ?? frequency;
}

export function formatContactSource(source: ContactSource): string {
  return CONTACT_SOURCE_LABELS[source] ?? source;
}

export function formatPaymentMethod(method: PaymentMethod | null | undefined, other?: string | null): string {
  if (!method) return "-";
  if (method === "other" && other?.trim()) {
    return `${PAYMENT_METHOD_LABELS.other}: ${other.trim()}`;
  }
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** תרגום הודעות שגיאה נפוצות מ-Supabase/Auth (הודעות מקור באנגלית). */
export function translateApiError(message: string): string {
  const lower = message.toLowerCase();
  const rules: Array<[RegExp | string, string]> = [
    [/invalid login credentials/i, "פרטי התחברות שגויים."],
    [/email not confirmed/i, "האימייל לא אושר."],
    [/user already registered/i, "המשתמש כבר רשום."],
    [/rate limit|too many requests|over_request_rate_limit/i, "יותר מדי בקשות. נסה שוב בעוד רגע."],
    [/jwt expired|session expired/i, "פג תוקף ההתחברות. התחבר מחדש."],
    [/row-level security|permission denied|not authorized/i, "אין הרשאה לפעולה זו."],
    [/duplicate key|unique constraint/i, "רשומה כפולה כבר קיימת במערכת."],
    [/network|fetch failed|failed to fetch/i, "שגיאת רשת. בדוק את החיבור ונסה שוב."],
  ];
  for (const [pattern, hebrew] of rules) {
    if (typeof pattern === "string" ? lower.includes(pattern) : pattern.test(message)) {
      return hebrew;
    }
  }
  return message;
}
