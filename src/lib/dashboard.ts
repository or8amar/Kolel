import type { ContactRecord, DashboardKpi, PaymentRecord } from "../types";

export function calculateDashboardKpis(contacts: ContactRecord[], payments: PaymentRecord[]): DashboardKpi {
  let monthlyRunRate = 0;
  let yearlyRunRate = 0;
  let totalOneTimeAmount = 0;

  for (const payment of payments) {
    if (payment.kind === "one_time") {
      totalOneTimeAmount += payment.amount;
      continue;
    }

    if (payment.frequency === "monthly") {
      monthlyRunRate += payment.amount;
      yearlyRunRate += payment.amount * 12;
    } else if (payment.frequency === "yearly") {
      yearlyRunRate += payment.amount;
      monthlyRunRate += payment.amount / 12;
    }
  }

  return {
    totalPotentials: contacts.length,
    activePayers: contacts.filter((c) => c.status === "active_payer").length,
    followUpCount: contacts.filter((c) => c.follow_up_required).length,
    monthlyRunRate: round2(monthlyRunRate),
    yearlyRunRate: round2(yearlyRunRate),
    totalOneTimeAmount: round2(totalOneTimeAmount),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
