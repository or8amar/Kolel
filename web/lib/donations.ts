import type { DonationType, PlanFrequency } from "@/lib/types";

export interface DonationFormInput {
  contactId: string;
  amount: number;
  type: DonationType;
  paidAt: string;
  currency: string;
  enteredBy?: string;
  frequency?: PlanFrequency;
  startDate?: string;
  endDate?: string;
}

export function validateDonationInput(input: DonationFormInput): string | null {
  if (!input.contactId) return "יש לבחור איש קשר.";
  if (!input.amount || Number.isNaN(input.amount) || input.amount <= 0) return "סכום חייב להיות גדול מ-0.";
  if (!input.paidAt) return "יש להזין תאריך תשלום.";
  if (input.type === "recurring") {
    if (!input.frequency) return "יש לבחור תדירות לתשלום מחזורי.";
    if (!input.startDate) return "יש להזין תאריך התחלה למסלול מחזורי.";
  }
  return null;
}
