"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { importFromBrowserContacts, parseCsvContacts, parseVcfContacts } from "@/lib/contacts-import";
import { supabase } from "@/lib/supabase/client";
import type { ImportedContact } from "@/lib/contacts-import";

export default function ImportContactsPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canUseBrowserApi = typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  async function saveContacts(rows: ImportedContact[]) {
    if (!rows.length) {
      setError("לא נמצאו אנשי קשר לייבוא.");
      return;
    }

    const contactsPayload = rows.map((row) => ({
      externalContactId: row.externalContactId ?? null,
      fullName: row.fullName,
      phones: row.phones,
      email: row.email ?? null,
      source: row.source,
    }));

    const { data: contactsData, error: contactsError } = await supabase.from("contacts").insert(contactsPayload).select("id");
    if (contactsError) {
      setError(contactsError.message);
      return;
    }

    const potentialsPayload = (contactsData ?? []).map((item) => ({
      contactId: item.id,
      status: "new_potential",
      priority: 3,
      notes: null,
      nextFollowUpAt: new Date().toISOString(),
    }));

    const { error: potentialError } = await supabase.from("payment_potentials").insert(potentialsPayload);
    if (potentialError) {
      setError(potentialError.message);
      return;
    }

    setMessage(`יובאו בהצלחה ${rows.length} אנשי קשר.`);
  }

  async function importFromBrowser() {
    setError("");
    setMessage("");
    try {
      const rows = await importFromBrowserContacts();
      await saveContacts(rows);
    } catch (importError) {
      setError((importError as Error).message);
    }
  }

  async function handleFile(file: File) {
    setError("");
    setMessage("");
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv")) {
      await saveContacts(parseCsvContacts(text));
      return;
    }
    if (lower.endsWith(".vcf")) {
      await saveContacts(parseVcfContacts(text));
      return;
    }
    setError("נתמכים רק קבצי CSV או VCF.");
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <h2 className="text-xl font-bold">ייבוא אנשי קשר</h2>
          <div className="rounded-xl border p-4">
            <p className="mb-3 text-sm text-slate-600">ייבוא מהיר מ-Browser Contacts API (כאשר נתמך).</p>
            <button
              disabled={!canUseBrowserApi}
              onClick={importFromBrowser}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              ייבוא מאנשי הקשר בדפדפן
            </button>
            {!canUseBrowserApi ? <p className="mt-2 text-sm text-amber-700">הדפדפן לא תומך ב-Browser Contacts API.</p> : null}
          </div>
          <div className="rounded-xl border p-4">
            <p className="mb-2 text-sm text-slate-600">Fallback לייבוא באמצעות CSV/VCF</p>
            <input
              type="file"
              accept=".csv,.vcf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="w-full rounded-lg border p-2"
            />
          </div>
          {message ? <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
