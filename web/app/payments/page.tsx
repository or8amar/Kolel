"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { validateDonationInput } from "@/lib/donations";
import { formatPaymentMethod, PAYMENT_METHOD_OPTIONS, translateApiError } from "@/lib/labels";
import { btnPrimary, fieldInput, fieldSelect } from "@/lib/ui";
import { supabase } from "@/lib/supabase/client";
import type { Contact, DonationType, PaymentMethod, PlanFrequency } from "@/lib/types";

export default function PaymentsPage() {
  const [contacts, setContacts] = useState<Pick<Contact, "id" | "fullName">[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
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
    paymentMethod: "credit" as PaymentMethod,
    paymentMethodOther: "",
  });

  useEffect(() => {
    void loadContacts();
  }, []);

  async function loadContacts() {
    setLoadingContacts(true);
    const { data, error: dbError } = await supabase
      .from("contacts")
      .select("id, fullName")
      .order("fullName", { ascending: true });
    if (dbError) {
      setError(translateApiError(dbError.message));
      setLoadingContacts(false);
      return;
    }
    setContacts((data as Pick<Contact, "id" | "fullName">[]) ?? []);
    setLoadingContacts(false);
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
      paymentMethod: form.paymentMethod,
      paymentMethodOther: form.paymentMethodOther,
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
    });
    if (validation) {
      setError(validation);
      return;
    }

    const paymentMethodOther =
      form.paymentMethod === "other" ? form.paymentMethodOther.trim() : null;

    const { error: donationError } = await supabase.from("donations").insert({
      contactId: form.contactId,
      amount,
      currency: form.currency,
      type: form.type,
      paymentMethod: form.paymentMethod,
      paymentMethodOther,
      paidAt: new Date(form.paidAt).toISOString(),
    });
    if (donationError) {
      setError(translateApiError(donationError.message));
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
        paymentMethod: form.paymentMethod,
        paymentMethodOther,
      });
      if (planError) {
        setError(translateApiError(planError.message));
        return;
      }
    }

    const { error: potentialError } = await supabase
      .from("payment_potentials")
      .update({ status: "paid", updatedAt: new Date().toISOString() })
      .eq("contactId", form.contactId);
    if (potentialError) {
      setError(translateApiError(potentialError.message));
      return;
    }

    setSuccess(`התשלום נשמר בהצלחה (${formatPaymentMethod(form.paymentMethod, paymentMethodOther)}).`);
    setForm((prev) => ({ ...prev, amount: "", endDate: "", paymentMethodOther: "" }));
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <h2 className="text-xl font-bold">הזנת תשלום ידנית</h2>
          {loadingContacts ? <p className="rounded-lg bg-slate-50 p-4 text-slate-600">טוען רשימת אנשי קשר...</p> : null}
          <form onSubmit={onSubmit} className="grid max-w-lg gap-3 rounded-xl border p-4 md:max-w-none">
            <select
              value={form.contactId}
              onChange={(e) => setForm((prev) => ({ ...prev, contactId: e.target.value }))}
              className={fieldSelect}
              required
              disabled={loadingContacts}
            >
              <option value="">{loadingContacts ? "טוען..." : "בחר איש קשר"}</option>
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
              placeholder="סכום *"
              className={fieldInput}
              required
            />
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as DonationType }))}
              className={fieldSelect}
            >
              <option value="one_time">חד פעמי</option>
              <option value="recurring">מחזורי</option>
            </select>
            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  paymentMethod: e.target.value as PaymentMethod,
                  paymentMethodOther: e.target.value === "other" ? prev.paymentMethodOther : "",
                }))
              }
              className={fieldSelect}
              required
            >
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <option key={method} value={method}>
                  {formatPaymentMethod(method)}
                </option>
              ))}
            </select>
            {form.paymentMethod === "other" ? (
              <input
                type="text"
                value={form.paymentMethodOther}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentMethodOther: e.target.value }))}
                placeholder="פרט אמצעי תשלום"
                className={fieldInput}
                required
              />
            ) : null}
            {form.type === "recurring" ? (
              <>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value as PlanFrequency }))}
                  className={fieldSelect}
                >
                  <option value="monthly">חודשי</option>
                  <option value="yearly">שנתי</option>
                </select>
                <input
                  type="date"
                  aria-label="תאריך התחלה"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className={fieldInput}
                />
                <input
                  type="date"
                  aria-label="תאריך סיום (אופציונלי)"
                  value={form.endDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className={fieldInput}
                />
              </>
            ) : null}
            <input
              type="date"
              aria-label="תאריך תשלום"
              value={form.paidAt}
              onChange={(e) => setForm((prev) => ({ ...prev, paidAt: e.target.value }))}
              className={fieldInput}
              required
            />
            <button type="submit" className={btnPrimary}>
              שמירת תשלום
            </button>
          </form>
          {success ? <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{success}</p> : null}
          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
