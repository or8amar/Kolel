export type ContactStatus = "new" | "contacted" | "committed" | "active_payer" | "inactive";
export type ContactSource = "manual" | "browser_contacts" | "csv" | "vcf";
export type PaymentKind = "one_time" | "recurring";
export type PaymentFrequency = "monthly" | "yearly";

export interface ContactInput {
  full_name: string;
  email?: string;
  phone?: string;
  source: ContactSource;
  status?: ContactStatus;
  follow_up_required?: boolean;
}

export interface ContactRecord extends ContactInput {
  id: string;
  status: ContactStatus;
  follow_up_required: boolean;
  created_at: string;
}

export interface PaymentInput {
  contact_id: string;
  amount: number;
  kind: PaymentKind;
  frequency?: PaymentFrequency;
  start_date: string;
  end_date?: string;
}

export interface PaymentRecord extends PaymentInput {
  id: string;
  created_at: string;
}

export interface DashboardKpi {
  totalPotentials: number;
  activePayers: number;
  followUpCount: number;
  monthlyRunRate: number;
  yearlyRunRate: number;
  totalOneTimeAmount: number;
}
