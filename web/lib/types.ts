export type PotentialStatus =
  | "new_potential"
  | "contacted"
  | "paying_active"
  | "not_interested"
  | "lapsed_payer";

export type ContactSource = "manual" | "browser_contacts" | "csv" | "vcf";
export type DonationType = "one_time" | "recurring";
export type PlanFrequency = "monthly" | "yearly";

export interface Contact {
  id: string;
  externalContactId: string | null;
  fullName: string;
  phones: string[] | null;
  email: string | null;
  source: ContactSource;
  createdAt: string;
}

export interface PaymentPotential {
  id: string;
  contactId: string;
  status: PotentialStatus;
  priority: number;
  notes: string | null;
  nextFollowUpAt: string | null;
  updatedAt: string;
}

export interface Donation {
  id: string;
  contactId: string;
  amount: number;
  currency: string;
  type: DonationType;
  paidAt: string;
  enteredBy: string | null;
}

export interface DonationPlan {
  id: string;
  contactId: string;
  frequency: PlanFrequency;
  startDate: string;
  endDate: string | null;
  amountPerCycle: number;
  isActive: boolean;
}

export interface StatusHistory {
  id: string;
  contactId: string;
  fromStatus: PotentialStatus | null;
  toStatus: PotentialStatus;
  changedAt: string;
  reason: string | null;
}

export interface ContactWithPotential extends Contact {
  payment_potentials: PaymentPotential[];
}
