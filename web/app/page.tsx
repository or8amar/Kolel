"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { calculateDashboardMetrics, getMonthlyTargetIls } from "@/lib/dashboard-metrics";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatPotentialStatus, translateApiError } from "@/lib/labels";
import { isActivePotentialStatus } from "@/lib/potential-status";
import { supabase } from "@/lib/supabase/client";
import type { Donation, PaymentPotential } from "@/lib/types";

type DashboardContact = { createdAt: string };

export default function DashboardPage() {
  const [contacts, setContacts] = useState<DashboardContact[]>([]);
  const [potentials, setPotentials] = useState<
    Pick<PaymentPotential, "id" | "contactId" | "status" | "nextFollowUpAt">[]
  >([]);
  const [donations, setDonations] = useState<Pick<Donation, "amount" | "type" | "paidAt">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [contactsRes, potentialsRes, donationsRes] = await Promise.all([
      supabase.from("contacts").select("createdAt"),
      supabase.from("payment_potentials").select("id, contactId, status, nextFollowUpAt"),
      supabase.from("donations").select("amount, type, paidAt"),
    ]);

    if (contactsRes.error || potentialsRes.error || donationsRes.error) {
      setError(
        translateApiError(
          contactsRes.error?.message ??
            potentialsRes.error?.message ??
            donationsRes.error?.message ??
            "שגיאה לא ידועה",
        ),
      );
      setLoading(false);
      return;
    }

    setContacts((contactsRes.data as DashboardContact[]) ?? []);
    setPotentials(
      (potentialsRes.data as Pick<PaymentPotential, "id" | "contactId" | "status" | "nextFollowUpAt">[]) ?? [],
    );
    setDonations((donationsRes.data as Pick<Donation, "amount" | "type" | "paidAt">[]) ?? []);
    setLoading(false);
  }

  const metrics = useMemo(
    () => calculateDashboardMetrics(contacts, potentials, donations),
    [contacts, potentials, donations],
  );

  const monthlyTarget = getMonthlyTargetIls();
  const gapToGoal =
    monthlyTarget != null ? Math.max(0, round2(monthlyTarget - metrics.monthCollected)) : null;

  const needsFollowUp = potentials
    .filter((p) => p.nextFollowUpAt && isActivePotentialStatus(p.status))
    .slice(0, 8);

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          {loading ? <p className="rounded-ep-sm bg-navy-pale p-4 text-ink-mid">טוען נתוני לוח בקרה...</p> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi title="מאגר אנשי קשר" value={metrics.totalContacts} />
            <Kpi title="פוטנציאלים פעילים" value={metrics.activePotentialsCount} />
            <Kpi
              title="פעילים לפי סטטוס"
              value={`חדש ${metrics.activeByStatus.new} · פוטנציאל ${metrics.activeByStatus.potential} · גבוה ${metrics.activeByStatus.high}`}
            />
            <Kpi title="גבוה" value={metrics.highCount} />
            <Kpi title="שילמו" value={metrics.paidCount} />
            <Kpi title="סה״כ נגבה" value={formatCurrency(metrics.totalCollected)} />
            <Kpi
              title="חד־פעמי"
              value={`${metrics.oneTimeCount} תשלומים · ${formatCurrency(metrics.oneTimeAmount)}`}
            />
            <Kpi
              title="מחזורי"
              value={`${metrics.recurringCount} תשלומים · ${formatCurrency(metrics.recurringAmount)}`}
            />
            <Kpi title="גיוס החודש (אנשי קשר חדשים)" value={metrics.monthContactsAdded} />
            <Kpi title="נגבה החודש" value={formatCurrency(metrics.monthCollected)} />
            {gapToGoal != null ? (
              <Kpi
                title={`פער ליעד חודשי (${formatCurrency(monthlyTarget!)})`}
                value={formatCurrency(gapToGoal)}
              />
            ) : null}
            <Kpi title="דורש מעקב (7 ימים)" value={metrics.followUpCount} />
          </div>

          <div className="ep-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">אנשים הדורשים מעקב</h2>
              <Link href="/potentials" className="ep-link text-sm">
                לכל הפוטנציאלים
              </Link>
            </div>
            <ul className="grid gap-2">
              {needsFollowUp.map((item) => (
                <li key={item.id} className="rounded-ep-sm border border-line p-3 text-sm">
                  <Link
                    href={`/potentials/${item.contactId}`}
                    className="flex min-h-10 items-center justify-between gap-2 font-medium text-navy"
                  >
                    <span>{formatPotentialStatus(item.status)}</span>
                    <span className="text-ink-mid">מעקב: {formatDate(item.nextFollowUpAt)}</span>
                  </Link>
                </li>
              ))}
              {!needsFollowUp.length ? <li className="text-sm text-ink-light">אין פריטי מעקב כרגע.</li> : null}
            </ul>
          </div>

          {error ? (
            <p className="rounded-ep-sm border border-danger/30 bg-danger-pale p-3 text-sm text-danger">{error}</p>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <article className="ep-kpi">
      <p className="ep-kpi-label">{title}</p>
      <p className="ep-kpi-value">{value}</p>
    </article>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
