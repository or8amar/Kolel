"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { validateDonationInput } from "@/lib/donations";
import { supabase } from "@/lib/supabase/client";
import type { Contact, DonationType, PlanFrequency } from "@/lib/types";

export default function PaymentsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    contactId: "",
    amount: "",
    currency: "ILS",
    type: "one_time" as DonationType,
    paidAt: new Date().toISOString().slice(0, 10),
    frequency: "monthly" as PlanFrequency,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });

  useEffect(() => {
    void loadContacts();
  }, []);

  async function loadContacts() {
    const { data, error: dbError } = await supabase.from("contacts").select("*").order("fullName", { ascending: true });
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setContacts((data as Contact[]) ?? []);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const amount = Number(form.amount);
    const validation = validateDonationInput({
      contactId: form.contactId,
      amount,
      type: form.type,
      paidAt: form.paidAt,
      currency: form.currency,
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
    });
    if (validation) {
      setError(validation);
      return;
    }

    const { error: donationError } = await supabase.from("donations").insert({
      contactId: form.contactId,
      amount,
      currency: form.currency,
      type: form.type,
      paidAt: new Date(form.paidAt).toISOString(),
    });
    if (donationError) {
      setError(donationError.message);
      return;
    }

    if (form.type === "recurring") {
      const { error: planError } = await supabase.from("donation_plans").insert({
        contactId: form.contactId,
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.endDate || null,
        amountPerCycle: amount,
        isActive: true,
      });
      if (planError) {
        setError(planError.message);
        return;
      }
    }

    const { error: potentialError } = await supabase
      .from("payment_potentials")
      .update({ status: "paying_active", updatedAt: new Date().toISOString() })
      .eq("contactId", form.contactId);
    if (potentialError) {
      setError(potentialError.message);
      return;
    }

    setSuccess("התשלום נשמר בהצלחה.");
    setForm((prev) => ({ ...prev, amount: "", endDate: "" }));
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <h2 className="text-xl font-bold">הזנת תשלום ידנית</h2>
          <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4">
            <select
              value={form.contactId}
              onChange={(e) => setForm((prev) => ({ ...prev, contactId: e.target.value }))}
              className="rounded-lg border p-2"
              required
            >
              <option value="">בחר איש קשר</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.fullName}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="סכום"
              className="rounded-lg border p-2"
              required
            />
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as DonationType }))}
              className="rounded-lg border p-2"
            >
              <option value="one_time">חד פעמי</option>
              <option value="recurring">מחזורי</option>
            </select>
            {form.type === "recurring" ? (
              <>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value as PlanFrequency }))}
                  className="rounded-lg border p-2"
                >
                  <option value="monthly">חודשי</option>
                  <option value="yearly">שנתי</option>
                </select>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="rounded-lg border p-2"
                />
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="rounded-lg border p-2"
                />
              </>
            ) : null}
            <input
              type="date"
              value={form.paidAt}
              onChange={(e) => setForm((prev) => ({ ...prev, paidAt: e.target.value }))}
              className="rounded-lg border p-2"
              required
            />
            <button className="rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500">שמירת תשלום</button>
          </form>
          {success ? <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
