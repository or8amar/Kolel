import type { Donation, DonationPlan, PaymentPotential } from "@/lib/types";

export interface DashboardMetrics {
  potentialsCount: number;
  activePayersCount: number;
  monthlyDonations: number;
  yearlyDonations: number;
  totalDonations: number;
  followUpCount: number;
}

const FOLLOW_UP_DAYS = 7;

export function calculateDashboardMetrics(
  potentials: PaymentPotential[],
  donations: Donation[],
  plans: DonationPlan[],
): DashboardMetrics {
  const monthlyFromPlans = plans
    .filter((plan) => plan.isActive && plan.frequency === "monthly")
    .reduce((sum, plan) => sum + plan.amountPerCycle, 0);

  const yearlyFromPlans = plans
    .filter((plan) => plan.isActive && plan.frequency === "yearly")
    .reduce((sum, plan) => sum + plan.amountPerCycle, 0);

  const oneTimeTotal = donations.filter((d) => d.type === "one_time").reduce((sum, d) => sum + d.amount, 0);

  const recurringDonations = donations.filter((d) => d.type === "recurring");
  const recurringMonthly = recurringDonations.reduce((sum, d) => sum + d.amount, 0);

  const monthlyDonations = round2(monthlyFromPlans + recurringMonthly + yearlyFromPlans / 12);
  const yearlyDonations = round2(yearlyFromPlans + monthlyFromPlans * 12 + recurringMonthly * 12);
  const totalDonations = round2(oneTimeTotal + recurringDonations.reduce((sum, d) => sum + d.amount, 0));

  const now = new Date();
  const followUpLimit = new Date(now.getTime() + FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000);
  const followUpCount = potentials.filter((p) => {
    if (!p.nextFollowUpAt) return false;
    const followDate = new Date(p.nextFollowUpAt);
    return followDate <= followUpLimit && p.status !== "paying_active" && p.status !== "not_interested";
  }).length;

  return {
    potentialsCount: potentials.length,
    activePayersCount: potentials.filter((p) => p.status === "paying_active").length,
    monthlyDonations,
    yearlyDonations,
    totalDonations: round2(totalDonations),
    followUpCount,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
