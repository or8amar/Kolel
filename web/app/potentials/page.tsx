"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { supabase } from "@/lib/supabase/client";
import type { Contact, PaymentPotential, PotentialStatus } from "@/lib/types";

const statuses: PotentialStatus[] = ["new_potential", "contacted", "paying_active", "not_interested", "lapsed_payer"];

interface PotentialRow {
  id: string;
  contactId: string;
  status: PotentialStatus;
  priority: number;
  nextFollowUpAt: string | null;
  contactName: string;
  contactEmail: string | null;
}

export default function PotentialsPage() {
  const [rows, setRows] = useState<PotentialRow[]>([]);
  const [filter, setFilter] = useState<PotentialStatus | "all">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    const [potentialsRes, contactsRes] = await Promise.all([
      supabase.from("payment_potentials").select("*").order("updatedAt", { ascending: false }),
      supabase.from("contacts").select("id, fullName, email"),
    ]);
    if (potentialsRes.error || contactsRes.error) {
      setError(potentialsRes.error?.message ?? contactsRes.error?.message ?? "שגיאה בטעינת נתונים.");
      return;
    }
    const contacts = new Map((contactsRes.data as Contact[]).map((contact) => [contact.id, contact]));
    const mapped: PotentialRow[] = ((potentialsRes.data as PaymentPotential[]) ?? []).map((item) => {
      const contact = contacts.get(item.contactId);
      return {
        id: item.id,
        contactId: item.contactId,
        status: item.status,
        priority: item.priority,
        nextFollowUpAt: item.nextFollowUpAt,
        contactName: contact?.fullName ?? "ללא שם",
        contactEmail: contact?.email ?? null,
      };
    });
    setRows(mapped);
  }

  async function updateStatus(item: PotentialRow, newStatus: PotentialStatus) {
    const { error: updateError } = await supabase
      .from("payment_potentials")
      .update({ status: newStatus, updatedAt: new Date().toISOString() })
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.from("status_history").insert({
      contactId: item.contactId,
      fromStatus: item.status,
      toStatus: newStatus,
      reason: "עדכון ידני מרשימת פוטנציאלים",
    });
    await loadRows();
  }

  const filtered = useMemo(() => rows.filter((item) => (filter === "all" ? true : item.status === filter)), [rows, filter]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">ניהול פוטנציאלים</h2>
            <select
              className="rounded-lg border px-2 py-1 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as PotentialStatus | "all")}
            >
              <option value="all">כל הסטטוסים</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[780px] text-right text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2">שם</th>
                  <th className="p-2">אימייל</th>
                  <th className="p-2">עדיפות</th>
                  <th className="p-2">מעקב הבא</th>
                  <th className="p-2">סטטוס</th>
                  <th className="p-2">כרטיס איש קשר</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">{item.contactName}</td>
                    <td className="p-2">{item.contactEmail ?? "-"}</td>
                    <td className="p-2">{item.priority}</td>
                    <td className="p-2">{item.nextFollowUpAt ? new Date(item.nextFollowUpAt).toLocaleDateString("he-IL") : "-"}</td>
                    <td className="p-2">
                      <select
                        value={item.status}
                        onChange={(e) => void updateStatus(item, e.target.value as PotentialStatus)}
                        className="rounded-lg border p-1"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <Link href={`/potentials/${item.contactId}`} className="text-indigo-600 hover:text-indigo-500">
                        פתיחה
                      </Link>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={6}>
                      לא נמצאו תוצאות.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
