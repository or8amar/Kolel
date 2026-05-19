"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { FilterChips } from "@/components/filter-chips";
import { ListRowCard } from "@/components/list-row-card";
import { formatPotentialStatus, translateApiError } from "@/lib/labels";
import { fieldSelect } from "@/lib/ui";
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

function statusSelect(
  item: PotentialRow,
  onUpdate: (item: PotentialRow, status: PotentialStatus) => void,
  compact?: boolean,
) {
  return (
    <select
      value={item.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => void onUpdate(item, e.target.value as PotentialStatus)}
      className={
        compact
          ? "max-w-[7.5rem] rounded-full border border-line bg-cream px-2 py-1.5 text-xs font-medium text-ink"
          : "rounded-lg border p-1"
      }
      aria-label={`סטטוס ${item.contactName}`}
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
  );
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
          ? (contacts.get(contact.responsibleContactId)?.fullName ?? null)
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
          <h2 className="hidden text-xl font-bold md:block">ניהול פוטנציאלים</h2>

          <FilterChips
            value={listFilter}
            onChange={setListFilter}
            options={[
              { value: "all", label: "הכל" },
              { value: "active", label: "פעילים", icon: "📋" },
              { value: "archive", label: "ארכיון", icon: "✅" },
            ]}
          />

          <select
            className={`${fieldSelect} hidden max-w-xs text-sm md:block`}
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value as ListFilter)}
          >
            <option value="active">פעילים (חדש / פוטנציאל / גבוה)</option>
            <option value="archive">ארכיון (שילם / סירב / לא מעוניין)</option>
            <option value="all">הכל</option>
          </select>

          {loading ? <p className="rounded-lg bg-cream p-4 text-ink-mid">טוען פוטנציאלים...</p> : null}

          <ul className="md:hidden">
            {filtered.map((item) => (
              <ListRowCard
                key={item.id}
                title={item.contactName}
                subtitle={
                  item.nextFollowUpAt
                    ? `מעקב: ${new Date(item.nextFollowUpAt).toLocaleDateString("he-IL")}`
                    : item.contactEmail
                }
                href={`/potentials/${item.contactId}`}
                meta={item.responsibleName ? <span>אחראי: {item.responsibleName}</span> : null}
                trailing={statusSelect(item, updateStatus, true)}
              />
            ))}
            {!loading && !filtered.length ? (
              <li className="list-row p-4 text-center text-ink-light">לא נמצאו תוצאות.</li>
            ) : null}
          </ul>

          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full min-w-[780px] text-right text-sm">
              <thead className="bg-cream">
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
                    <td className="p-2">{statusSelect(item, updateStatus)}</td>
                    <td className="p-2">
                      <Link href={`/potentials/${item.contactId}`} className="text-navy hover:text-navy-light">
                        פתיחה
                      </Link>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td className="p-3 text-ink-light" colSpan={6}>
                      לא נמצאו תוצאות.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {error ? <p className="rounded-lg bg-danger-pale p-2 text-sm text-danger">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
