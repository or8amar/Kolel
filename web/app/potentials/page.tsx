"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { formatPotentialStatus, translateApiError } from "@/lib/labels";
import {
  ACTIVE_POTENTIAL_STATUSES,
  CLOSED_POTENTIAL_STATUSES,
  isActivePotentialStatus,
  isClosedPotentialStatus,
} from "@/lib/potential-status";
import { supabase } from "@/lib/supabase/client";
import type { Contact, PaymentPotential, PotentialStatus } from "@/lib/types";

type ListFilter = "active" | "archive" | "all";

interface PotentialRow {
  id: string;
  contactId: string;
  status: PotentialStatus;
  nextFollowUpAt: string | null;
  contactName: string;
  contactEmail: string | null;
  responsibleName: string | null;
}

export default function PotentialsPage() {
  const [rows, setRows] = useState<PotentialRow[]>([]);
  const [listFilter, setListFilter] = useState<ListFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    const [potentialsRes, contactsRes] = await Promise.all([
      supabase
        .from("payment_potentials")
        .select("id, contactId, status, nextFollowUpAt")
        .order("updatedAt", { ascending: false }),
      supabase.from("contacts").select("id, fullName, email, responsibleContactId"),
    ]);
    if (potentialsRes.error || contactsRes.error) {
      setError(
        translateApiError(potentialsRes.error?.message ?? contactsRes.error?.message ?? "שגיאה בטעינת נתונים."),
      );
      setLoading(false);
      return;
    }
    const contacts = new Map((contactsRes.data as Contact[]).map((contact) => [contact.id, contact]));
    const mapped: PotentialRow[] = ((potentialsRes.data as PaymentPotential[]) ?? []).map((item) => {
      const contact = contacts.get(item.contactId);
      const responsible =
        contact?.responsibleContactId != null
          ? contacts.get(contact.responsibleContactId)?.fullName ?? null
          : null;
      return {
        id: item.id,
        contactId: item.contactId,
        status: item.status,
        nextFollowUpAt: item.nextFollowUpAt,
        contactName: contact?.fullName ?? "ללא שם",
        contactEmail: contact?.email ?? null,
        responsibleName: responsible,
      };
    });
    setRows(mapped);
    setLoading(false);
  }

  async function updateStatus(item: PotentialRow, newStatus: PotentialStatus) {
    const { error: updateError } = await supabase
      .from("payment_potentials")
      .update({ status: newStatus, updatedAt: new Date().toISOString() })
      .eq("id", item.id);
    if (updateError) {
      setError(translateApiError(updateError.message));
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

  const filtered = useMemo(() => {
    return rows.filter((item) => {
      if (listFilter === "active") return isActivePotentialStatus(item.status);
      if (listFilter === "archive") return isClosedPotentialStatus(item.status);
      return true;
    });
  }, [rows, listFilter]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">ניהול פוטנציאלים</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/contacts" className="text-sm text-indigo-600 hover:text-indigo-500">
                כל אנשי הקשר
              </Link>
              <select
                className="rounded-lg border px-2 py-1 text-sm"
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value as ListFilter)}
              >
                <option value="active">פעילים (חדש / פוטנציאל / גבוה)</option>
                <option value="archive">ארכיון (שילם / סירב / לא מעוניין)</option>
                <option value="all">הכל</option>
              </select>
            </div>
          </div>

          {loading ? <p className="rounded-lg bg-slate-50 p-4 text-slate-600">טוען פוטנציאלים...</p> : null}

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[780px] text-right text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2">שם</th>
                  <th className="p-2">אימייל</th>
                  <th className="p-2">אחראי</th>
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
                    <td className="p-2">{item.responsibleName ?? "-"}</td>
                    <td className="p-2">
                      {item.nextFollowUpAt ? new Date(item.nextFollowUpAt).toLocaleDateString("he-IL") : "-"}
                    </td>
                    <td className="p-2">
                      <select
                        value={item.status}
                        onChange={(e) => void updateStatus(item, e.target.value as PotentialStatus)}
                        className="rounded-lg border p-1"
                      >
                        {ACTIVE_POTENTIAL_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {formatPotentialStatus(status)}
                          </option>
                        ))}
                        <optgroup label="סגירה">
                          {CLOSED_POTENTIAL_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {formatPotentialStatus(status)}
                            </option>
                          ))}
                        </optgroup>
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
