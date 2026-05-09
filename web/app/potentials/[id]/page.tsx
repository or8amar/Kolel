"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { formatCurrency, formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import type { Contact, Donation, PaymentPotential, StatusHistory } from "@/lib/types";

export default function PotentialDetailsPage() {
  const params = useParams<{ id: string }>();
  const contactId = params.id;
  const [contact, setContact] = useState<Contact | null>(null);
  const [potential, setPotential] = useState<PaymentPotential | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (contactId) void loadData(contactId);
  }, [contactId]);

  async function loadData(id: string) {
    const [contactRes, potentialRes, historyRes, donationsRes] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", id).single(),
      supabase.from("payment_potentials").select("*").eq("contactId", id).single(),
      supabase.from("status_history").select("*").eq("contactId", id).order("changedAt", { ascending: false }),
      supabase.from("donations").select("*").eq("contactId", id).order("paidAt", { ascending: false }),
    ]);

    if (contactRes.error || potentialRes.error || historyRes.error || donationsRes.error) {
      setError(contactRes.error?.message ?? potentialRes.error?.message ?? historyRes.error?.message ?? donationsRes.error?.message ?? "שגיאה");
      return;
    }

    setContact(contactRes.data as Contact);
    setPotential(potentialRes.data as PaymentPotential);
    setHistory((historyRes.data as StatusHistory[]) ?? []);
    setDonations((donationsRes.data as Donation[]) ?? []);
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">כרטיס איש קשר</h2>
            <Link href="/potentials" className="text-sm text-indigo-600">
              חזרה לרשימה
            </Link>
          </div>

          <section className="rounded-xl border p-4">
            <h3 className="mb-3 text-lg font-semibold">פרטים</h3>
            <div className="grid gap-2 text-sm">
              <p>שם: {contact?.fullName ?? "-"}</p>
              <p>אימייל: {contact?.email ?? "-"}</p>
              <p>טלפונים: {contact?.phones?.join(", ") || "-"}</p>
              <p>סטטוס נוכחי: {potential?.status ?? "-"}</p>
              <p>מעקב הבא: {formatDate(potential?.nextFollowUpAt ?? null)}</p>
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <h3 className="mb-3 text-lg font-semibold">היסטוריית סטטוסים</h3>
            <ul className="grid gap-2 text-sm">
              {history.map((item) => (
                <li key={item.id} className="rounded-lg border p-2">
                  <p>
                    {item.fromStatus ?? "none"} -&gt; {item.toStatus}
                  </p>
                  <p className="text-slate-500">{formatDate(item.changedAt)}</p>
                  <p>{item.reason ?? "-"}</p>
                </li>
              ))}
              {!history.length ? <li className="text-slate-500">אין היסטוריית סטטוסים.</li> : null}
            </ul>
          </section>

          <section className="rounded-xl border p-4">
            <h3 className="mb-3 text-lg font-semibold">היסטוריית תשלומים</h3>
            <ul className="grid gap-2 text-sm">
              {donations.map((donation) => (
                <li key={donation.id} className="rounded-lg border p-2">
                  <p>{formatCurrency(donation.amount, donation.currency)}</p>
                  <p>סוג: {donation.type}</p>
                  <p>תאריך: {formatDate(donation.paidAt)}</p>
                </li>
              ))}
              {!donations.length ? <li className="text-slate-500">אין תשלומים לאיש קשר זה.</li> : null}
            </ul>
          </section>

          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
