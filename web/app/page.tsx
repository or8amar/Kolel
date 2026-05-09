"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { calculateDashboardMetrics } from "@/lib/dashboard-metrics";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { Donation, DonationPlan, PaymentPotential } from "@/lib/types";

export default function DashboardPage() {
  const [potentials, setPotentials] = useState<PaymentPotential[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [plans, setPlans] = useState<DonationPlan[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    const [potentialsRes, donationsRes, plansRes] = await Promise.all([
      supabase.from("payment_potentials").select("*").order("updatedAt", { ascending: false }),
      supabase.from("donations").select("*").order("paidAt", { ascending: false }),
      supabase.from("donation_plans").select("*").eq("isActive", true),
    ]);

    if (potentialsRes.error || donationsRes.error || plansRes.error) {
      setError(potentialsRes.error?.message ?? donationsRes.error?.message ?? plansRes.error?.message ?? "שגיאה לא ידועה");
      return;
    }

    setPotentials((potentialsRes.data as PaymentPotential[]) ?? []);
    setDonations((donationsRes.data as Donation[]) ?? []);
    setPlans((plansRes.data as DonationPlan[]) ?? []);
  }

  const metrics = useMemo(() => calculateDashboardMetrics(potentials, donations, plans), [potentials, donations, plans]);
  const needsFollowUp = potentials.filter((p) => p.nextFollowUpAt).slice(0, 8);

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi title="כמות פוטנציאלים" value={metrics.potentialsCount} />
            <Kpi title="משלמים פעילים" value={metrics.activePayersCount} />
            <Kpi title="דורש מעקב" value={metrics.followUpCount} />
            <Kpi title="תרומות חודשיות" value={formatCurrency(metrics.monthlyDonations)} />
            <Kpi title="תרומות שנתיות" value={formatCurrency(metrics.yearlyDonations)} />
            <Kpi title="סה״כ תרומות" value={formatCurrency(metrics.totalDonations)} />
          </div>

          <div className="rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">אנשים הדורשים מעקב</h2>
              <Link href="/potentials" className="text-sm text-indigo-600 hover:text-indigo-500">
                לכל הפוטנציאלים
              </Link>
            </div>
            <ul className="grid gap-2">
              {needsFollowUp.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <span>{item.status}</span>
                  <span>מעקב: {formatDate(item.nextFollowUpAt)}</span>
                </li>
              ))}
              {!needsFollowUp.length ? <li className="text-sm text-slate-500">אין פריטי מעקב כרגע.</li> : null}
            </ul>
          </div>

          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <article className="rounded-xl border bg-slate-50 p-4">
      <p className="text-sm text-slate-600">{title}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}
