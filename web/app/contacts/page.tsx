"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { translateApiError } from "@/lib/labels";
import { supabase } from "@/lib/supabase/client";
import type { Contact } from "@/lib/types";

const PAGE_SIZE = 50;

interface ContactRow {
  id: string;
  fullName: string;
  email: string | null;
  phones: string[];
  responsibleName: string | null;
  createdAt: string;
}

export default function ContactsPage() {
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const nameByIdRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    void loadRows(page);
  }, [page]);

  async function ensureNameIndex() {
    if (nameByIdRef.current.size > 0) return nameByIdRef.current;

    const { data, error: namesError } = await supabase.from("contacts").select("id, fullName");
    if (namesError) return nameByIdRef.current;

    nameByIdRef.current = new Map((data as Pick<Contact, "id" | "fullName">[]).map((c) => [c.id, c.fullName]));
    return nameByIdRef.current;
  }

  async function loadRows(pageIndex: number) {
    setLoading(true);
    setError("");

    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const [contactsRes, namesMap] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, fullName, phones, email, responsibleContactId, createdAt", { count: "exact" })
        .order("createdAt", { ascending: false })
        .range(from, to),
      ensureNameIndex(),
    ]);

    if (contactsRes.error) {
      setError(translateApiError(contactsRes.error.message ?? "שגיאה בטעינת נתונים."));
      setLoading(false);
      return;
    }

    const contacts = (contactsRes.data as Contact[]) ?? [];
    setTotalCount(contactsRes.count ?? contacts.length);
    setRows(
      contacts.map((contact) => ({
        id: contact.id,
        fullName: contact.fullName,
        email: contact.email,
        phones: contact.phones ?? [],
        responsibleName: contact.responsibleContactId
          ? (namesMap.get(contact.responsibleContactId) ?? null)
          : null,
        createdAt: contact.createdAt,
      })),
    );
    setLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showEmpty = !loading && rows.length === 0;

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">אנשי קשר</h2>
              <p className="mt-1 text-sm text-slate-600">
                רשימת כל אנשי הקשר במערכת. לניהול סטטוס ומעקב —{" "}
                <Link href="/potentials" className="text-indigo-600 hover:text-indigo-500">
                  עמוד הפוטנציאלים
                </Link>
                .
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href="/contacts/add" className="text-indigo-600 hover:text-indigo-500">
                הוספת איש קשר
              </Link>
              <Link href="/import" className="text-indigo-600 hover:text-indigo-500">
                ייבוא
              </Link>
            </div>
          </div>

          {loading ? <p className="rounded-lg bg-slate-50 p-4 text-slate-600">טוען אנשי קשר...</p> : null}

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2">שם</th>
                  <th className="p-2">אימייל</th>
                  <th className="p-2">טלפונים</th>
                  <th className="p-2">אחראי</th>
                  <th className="p-2">נוצר</th>
                  <th className="p-2">כרטיס</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.fullName}</td>
                    <td className="p-2">{row.email ?? "-"}</td>
                    <td className="p-2">{row.phones.join(", ") || "-"}</td>
                    <td className="p-2">{row.responsibleName ?? "-"}</td>
                    <td className="p-2">{new Date(row.createdAt).toLocaleDateString("he-IL")}</td>
                    <td className="p-2">
                      <Link href={`/potentials/${row.id}`} className="text-indigo-600 hover:text-indigo-500">
                        פתיחה
                      </Link>
                    </td>
                  </tr>
                ))}
                {showEmpty ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={6}>
                      אין אנשי קשר במערכת.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {totalCount > PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-600">
                {totalCount} אנשי קשר · עמוד {page + 1} מתוך {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border px-3 py-1 disabled:opacity-40"
                >
                  הקודם
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1 || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1 disabled:opacity-40"
                >
                  הבא
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
