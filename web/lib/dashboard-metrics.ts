import { ACTIVE_POTENTIAL_STATUSES } from "@/lib/potential-status";
import type { Donation, PaymentPotential, PotentialStatus } from "@/lib/types";

type ContactMetricInput = Pick<import("@/lib/types").Contact, "createdAt">;
type PotentialMetricInput = Pick<PaymentPotential, "status" | "nextFollowUpAt">;
type DonationMetricInput = Pick<Donation, "amount" | "type" | "paidAt">;

export interface DashboardMetrics {
  totalContacts: number;
  activePotentialsCount: number;
  activeByStatus: Record<"new" | "potential" | "high", number>;
  highCount: number;
  paidCount: number;
  totalCollected: number;
  oneTimeCount: number;
  oneTimeAmount: number;
  recurringCount: number;
  recurringAmount: number;
  monthContactsAdded: number;
  monthCollected: number;
  followUpCount: number;
}

const FOLLOW_UP_DAYS = 7;

function isCurrentMonth(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function sumAmounts(items: DonationMetricInput[]): number {
  return round2(items.reduce((sum, item) => sum + item.amount, 0));
}

export function calculateDashboardMetrics(
  contacts: ContactMetricInput[],
  potentials: PotentialMetricInput[],
  donations: DonationMetricInput[],
): DashboardMetrics {
  const activeByStatus: Record<"new" | "potential" | "high", number> = {
    new: 0,
    potential: 0,
    high: 0,
  };

  for (const status of ACTIVE_POTENTIAL_STATUSES) {
    activeByStatus[status] = potentials.filter((p) => p.status === status).length;
  }

  const oneTime = donations.filter((d) => d.type === "one_time");
  const recurring = donations.filter((d) => d.type === "recurring");

  const now = new Date();
  const followUpLimit = new Date(now.getTime() + FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000);
  const closedStatuses: PotentialStatus[] = ["paid", "refused", "not_interested"];
  const followUpCount = potentials.filter((p) => {
    if (!p.nextFollowUpAt) return false;
    if (closedStatuses.includes(p.status)) return false;
    const followDate = new Date(p.nextFollowUpAt);
    return followDate <= followUpLimit;
  }).length;

  const monthDonations = donations.filter((d) => isCurrentMonth(d.paidAt));

  return {
    totalContacts: contacts.length,
    activePotentialsCount: potentials.filter((p) =>
      (ACTIVE_POTENTIAL_STATUSES as readonly PotentialStatus[]).includes(p.status),
    ).length,
    activeByStatus,
    highCount: activeByStatus.high,
    paidCount: potentials.filter((p) => p.status === "paid").length,
    totalCollected: sumAmounts(donations),
    oneTimeCount: oneTime.length,
    oneTimeAmount: sumAmounts(oneTime),
    recurringCount: recurring.length,
    recurringAmount: sumAmounts(recurring),
    monthContactsAdded: contacts.filter((c) => isCurrentMonth(c.createdAt)).length,
    monthCollected: sumAmounts(monthDonations),
    followUpCount,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getMonthlyTargetIls(): number | null {
  const raw = process.env.NEXT_PUBLIC_MONTHLY_TARGET_ILS;
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
