import { describe, expect, it } from "vitest";
import { calculateDashboardKpis } from "../lib/dashboard";
import type { ContactRecord, PaymentRecord } from "../types";

describe("calculateDashboardKpis", () => {
  it("calculates run rates and tracking counts", () => {
    const contacts: ContactRecord[] = [
      {
        id: "1",
        full_name: "A",
        source: "manual",
        status: "active_payer",
        follow_up_required: false,
        created_at: "2026-01-01",
      },
      {
        id: "2",
        full_name: "B",
        source: "manual",
        status: "contacted",
        follow_up_required: true,
        created_at: "2026-01-01",
      },
    ];
    const payments: PaymentRecord[] = [
      {
        id: "p1",
        contact_id: "1",
        amount: 100,
        kind: "recurring",
        frequency: "monthly",
        start_date: "2026-01-01",
        created_at: "2026-01-01",
      },
      {
        id: "p2",
        contact_id: "2",
        amount: 1200,
        kind: "recurring",
        frequency: "yearly",
        start_date: "2026-01-01",
        created_at: "2026-01-01",
      },
      {
        id: "p3",
        contact_id: "2",
        amount: 300,
        kind: "one_time",
        start_date: "2026-01-01",
        created_at: "2026-01-01",
      },
    ];

    const kpi = calculateDashboardKpis(contacts, payments);
    expect(kpi.totalPotentials).toBe(2);
    expect(kpi.activePayers).toBe(1);
    expect(kpi.followUpCount).toBe(1);
    expect(kpi.monthlyRunRate).toBe(200);
    expect(kpi.yearlyRunRate).toBe(2400);
    expect(kpi.totalOneTimeAmount).toBe(300);
  });
});
