"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  formatDonationType,
  formatPaymentMethod,
  formatPotentialStatus,
  translateApiError,
} from "@/lib/labels";
import { supabase } from "@/lib/supabase/client";
import { fieldInput, fieldSelect } from "@/lib/ui";
import type { Contact, Donation, PaymentPotential, StatusHistory } from "@/lib/types";

export default function PotentialDetailsPage() {
  const params = useParams<{ id: string }>();
  const contactId = params.id;
  const [contact, setContact] = useState<Contact | null>(null);
  const [potential, setPotential] = useState<PaymentPotential | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [responsibleName, setResponsibleName] = useState<string | null>(null);
  const [responsibleOptions, setResponsibleOptions] = useState<Pick<Contact, "id" | "fullName">[]>([]);
  const [responsibleSearch, setResponsibleSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingResponsibleOptions, setLoadingResponsibleOptions] = useState(false);
  const [savingResponsible, setSavingResponsible] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (contactId) void loadData(contactId);
  }, [contactId]);

  useEffect(() => {
    if (!contactId) return;
    const timer = setTimeout(() => {
      void loadResponsibleOptions(contactId, responsibleSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [contactId, responsibleSearch, contact?.responsibleContactId]);

  async function loadResponsibleOptions(id: string, query: string) {
    setLoadingResponsibleOptions(true);
    let builder = supabase
      .from("contacts")
      .select("id, fullName")
      .neq("id", id)
      .order("fullName")
      .limit(30);
    const q = query.trim();
    if (q) {
      builder = builder.ilike("fullName", `%${q}%`);
    }
    const { data, error: searchError } = await builder;
    if (searchError) {
      setLoadingResponsibleOptions(false);
      return;
    }
    const options = (data as Pick<Contact, "id" | "fullName">[]) ?? [];
    const selectedId = contact?.responsibleContactId;
    if (selectedId && !options.some((c) => c.id === selectedId)) {
      const { data: selected } = await supabase
        .from("contacts")
        .select("id, fullName")
        .eq("id", selectedId)
        .maybeSingle();
      if (selected) {
        options.unshift(selected as Pick<Contact, "id" | "fullName">);
      }
    }
    setResponsibleOptions(options);
    setLoadingResponsibleOptions(false);
  }

  async function loadResponsibleName(responsibleContactId: string | null) {
    if (!responsibleContactId) {
      setResponsibleName(null);
      return;
    }
    const { data } = await supabase
      .from("contacts")
      .select("fullName")
      .eq("id", responsibleContactId)
      .maybeSingle();
    setResponsibleName((data as { fullName: string } | null)?.fullName ?? null);
  }

  async function loadData(id: string) {
    setLoading(true);
    const [contactRes, potentialRes, historyRes, donationsRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, fullName, phones, email, responsibleContactId")
        .eq("id", id)
        .single(),
      supabase
        .from("payment_potentials")
        .select("id, contactId, status, nextFollowUpAt, notes")
        .eq("contactId", id)
        .single(),
      supabase
        .from("status_history")
        .select("id, fromStatus, toStatus, changedAt, reason")
        .eq("contactId", id)
        .order("changedAt", { ascending: false }),
      supabase
        .from("donations")
        .select("id, amount, currency, type, paymentMethod, paymentMethodOther, paidAt")
        .eq("contactId", id)
        .order("paidAt", { ascending: false }),
    ]);

    if (contactRes.error || potentialRes.error || historyRes.error || donationsRes.error) {
      setError(
        translateApiError(
          contactRes.error?.message ??
            potentialRes.error?.message ??
            historyRes.error?.message ??
            donationsRes.error?.message ??
            "שגיאה",
        ),
      );
      setLoading(false);
      return;
    }

    const loadedContact = contactRes.data as Contact;
    setContact(loadedContact);
    setPotential(potentialRes.data as PaymentPotential);
    setHistory((historyRes.data as StatusHistory[]) ?? []);
    setDonations((donationsRes.data as Donation[]) ?? []);
    await loadResponsibleName(loadedContact.responsibleContactId);
    setLoading(false);
  }

  async function saveResponsible(responsibleContactId: string | null) {
    if (!contactId) return;
    setSavingResponsible(true);
    setError("");
    setSuccess("");
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ responsibleContactId })
      .eq("id", contactId);
    setSavingResponsible(false);
    if (updateError) {
      setError(translateApiError(updateError.message));
      return;
    }
    setSuccess(responsibleContactId ? "האחראי עודכן." : "האחראי הוסר.");
    setContact((prev) => (prev ? { ...prev, responsibleContactId } : prev));
    await loadResponsibleName(responsibleContactId);
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

          {loading ? <p className="rounded-lg bg-slate-50 p-4 text-slate-600">טוען כרטיס איש קשר...</p> : null}

          <section className="rounded-xl border p-4">
            <h3 className="mb-3 text-lg font-semibold">פרטים</h3>
            <div className="grid gap-2 text-sm">
              <p>שם: {contact?.fullName ?? "-"}</p>
              <p>אימייל: {contact?.email ?? "-"}</p>
              <p>
                טלפונים:{" "}
                {contact?.phones?.length ? (
                  <span className="inline-flex flex-wrap gap-2">
                    {contact.phones.map((phone) => (
                      <a key={phone} href={`tel:${phone}`} className="text-indigo-600 underline">
                        {phone}
                      </a>
                    ))}
                  </span>
                ) : (
                  "-"
                )}
              </p>
              <p>סטטוס נוכחי: {potential ? formatPotentialStatus(potential.status) : "-"}</p>
              <p>מעקב הבא: {formatDate(potential?.nextFollowUpAt ?? null)}</p>
              <p>אחראי: {responsibleName ?? "לא הוגדר"}</p>
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <h3 className="mb-3 text-lg font-semibold">אחראי (איש קשר)</h3>
            <div className="grid gap-2">
              <input
                type="search"
                value={responsibleSearch}
                onChange={(e) => setResponsibleSearch(e.target.value)}
                placeholder="חיפוש לפי שם..."
                className={fieldInput}
              />
              <select
                className={fieldSelect}
                disabled={savingResponsible || loadingResponsibleOptions}
                value={contact?.responsibleContactId ?? ""}
                onChange={(e) => void saveResponsible(e.target.value || null)}
              >
                <option value="">{loadingResponsibleOptions ? "טוען..." : "ללא אחראי"}</option>
                {responsibleOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-xl border p-4">
            <h3 className="mb-3 text-lg font-semibold">היסטוריית סטטוסים</h3>
            <ul className="grid gap-2 text-sm">
              {history.map((item) => (
                <li key={item.id} className="rounded-lg border p-2">
                  <p>
                    {formatPotentialStatus(item.fromStatus)} ← {formatPotentialStatus(item.toStatus)}
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
                  <p>סוג: {formatDonationType(donation.type)}</p>
                  <p>אמצעי: {formatPaymentMethod(donation.paymentMethod, donation.paymentMethodOther)}</p>
                  <p>תאריך: {formatDate(donation.paidAt)}</p>
                </li>
              ))}
              {!donations.length ? <li className="text-slate-500">אין תשלומים לאיש קשר זה.</li> : null}
            </ul>
          </section>

          {success ? <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
