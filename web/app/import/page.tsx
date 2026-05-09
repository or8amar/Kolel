"use client";

import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import {
  buildManualContact,
  importFromBrowserContacts,
  makeContactKey,
  parseCsvContacts,
  parseExcelContacts,
  parseJsonContacts,
  parsePastedText,
  parseVcfContacts,
} from "@/lib/contacts-import";
import { supabase } from "@/lib/supabase/client";
import type { ImportedContact } from "@/lib/contacts-import";

const BATCH_SIZE = 200;

type TabKey = "files" | "paste" | "manual";

interface ImportSummary {
  imported: number;
  skippedDuplicates: number;
  failed: number;
  errors: string[];
}

export default function ImportContactsPage() {
  const [tab, setTab] = useState<TabKey>("files");
  const [parsed, setParsed] = useState<ImportedContact[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUseBrowserApi =
    typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  function reset() {
    setParsed([]);
    setProgress({ done: 0, total: 0 });
    setSummary(null);
    setError("");
    setInfo("");
    setPastedText("");
    setManualName("");
    setManualPhone("");
    setManualEmail("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function applyParsed(rows: ImportedContact[], successMessage?: string) {
    if (!rows.length) {
      setError("לא זוהו אנשי קשר תקינים.");
      return;
    }
    const map = new Map<string, ImportedContact>();
    for (const c of rows) map.set(makeContactKey(c.fullName, c.phones, c.email), c);
    const unique = Array.from(map.values());
    setParsed(unique);
    setSummary(null);
    setError("");
    setInfo(successMessage ?? `זוהו ${unique.length} אנשי קשר ייחודיים. בדוק את התצוגה ולחץ על ייבוא.`);
  }

  async function handleFiles(files: FileList | File[]) {
    setError("");
    setSummary(null);
    setInfo("");
    const all: ImportedContact[] = [];
    try {
      for (const file of Array.from(files)) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".csv")) {
          all.push(...parseCsvContacts(await file.text()));
        } else if (lower.endsWith(".vcf") || lower.endsWith(".vcard")) {
          all.push(...parseVcfContacts(await file.text()));
        } else if (lower.endsWith(".json")) {
          all.push(...parseJsonContacts(await file.text()));
        } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
          all.push(...(await parseExcelContacts(file)));
        } else {
          setError(`קובץ לא נתמך: ${file.name}. נתמכים: CSV, VCF, XLSX, XLS, JSON.`);
          return;
        }
      }
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    applyParsed(all);
  }

  function handlePasteParse() {
    setError("");
    setSummary(null);
    if (!pastedText.trim()) {
      setError("הדבק רשימה לפני הניתוח.");
      return;
    }
    const rows = parsePastedText(pastedText);
    applyParsed(rows);
  }

  function handleManualAdd() {
    setError("");
    setSummary(null);
    if (!manualName.trim()) {
      setError("שם הוא שדה חובה.");
      return;
    }
    const phones = manualPhone
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const contact = buildManualContact({
      fullName: manualName,
      phones,
      email: manualEmail,
    });
    setParsed((prev) => {
      const next = [...prev, contact];
      const map = new Map<string, ImportedContact>();
      for (const c of next) map.set(makeContactKey(c.fullName, c.phones, c.email), c);
      return Array.from(map.values());
    });
    setManualName("");
    setManualPhone("");
    setManualEmail("");
    setInfo("נוסף לרשימה. ניתן להוסיף עוד או ללחוץ על ייבוא.");
  }

  async function importFromBrowser() {
    setError("");
    setSummary(null);
    setInfo("");
    try {
      const rows = await importFromBrowserContacts();
      applyParsed(rows);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runImport() {
    if (!parsed.length || running) return;
    setRunning(true);
    setError("");
    setSummary(null);
    setProgress({ done: 0, total: parsed.length });

    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const { data: existing, error: existingError } = await supabase
        .from("contacts")
        .select("fullName, phones, email");
      if (existingError) throw new Error(existingError.message);

      const existingKeys = new Set(
        (existing ?? []).map((c) =>
          makeContactKey(
            (c as { fullName: string }).fullName ?? "",
            (c as { phones?: string[] | null }).phones ?? [],
            (c as { email?: string | null }).email ?? null,
          ),
        ),
      );

      const toInsert: ImportedContact[] = [];
      for (const c of parsed) {
        if (existingKeys.has(makeContactKey(c.fullName, c.phones, c.email))) {
          skipped += 1;
        } else {
          toInsert.push(c);
        }
      }

      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const payload = batch.map((row) => ({
          externalContactId: row.externalContactId ?? null,
          fullName: row.fullName,
          phones: row.phones,
          email: row.email ?? null,
          source: row.source,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from("contacts")
          .insert(payload)
          .select("id");

        if (insertError) {
          failed += batch.length;
          errors.push(`קבוצה ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`);
          continue;
        }

        const potentialsPayload = (inserted ?? []).map((item) => ({
          contactId: (item as { id: string }).id,
          status: "new_potential" as const,
          priority: 3,
          notes: null,
          nextFollowUpAt: new Date().toISOString(),
        }));

        if (potentialsPayload.length) {
          const { error: potError } = await supabase
            .from("payment_potentials")
            .insert(potentialsPayload);
          if (potError) {
            errors.push(
              `קבוצה ${Math.floor(i / BATCH_SIZE) + 1}: שגיאה ביצירת פוטנציאלים - ${potError.message}`,
            );
          }
        }

        imported += inserted?.length ?? 0;
        setProgress({ done: skipped + imported + failed, total: parsed.length });
      }

      setSummary({ imported, skippedDuplicates: skipped, failed, errors });
      setParsed([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const previewRows = useMemo(() => parsed.slice(0, 50), [parsed]);

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">ייבוא אנשי קשר</h2>
            {(parsed.length > 0 || summary) && (
              <button
                onClick={reset}
                className="rounded-lg border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                ניקוי
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-b">
            <TabBtn active={tab === "files"} onClick={() => setTab("files")}>
              מקבצים (CSV / VCF / Excel / JSON)
            </TabBtn>
            <TabBtn active={tab === "paste"} onClick={() => setTab("paste")}>
              הדבקת רשימה
            </TabBtn>
            <TabBtn active={tab === "manual"} onClick={() => setTab("manual")}>
              הוספה ידנית
            </TabBtn>
          </div>

          {tab === "files" ? (
            <div className="grid gap-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600"
              >
                <p>גרור לכאן קבצים או בחר ידנית</p>
                <p className="text-xs text-slate-500">
                  נתמכים: Google CSV, Outlook CSV, VCF (גם WhatsApp), Excel (.xlsx/.xls), JSON
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.vcf,.vcard,.xlsx,.xls,.json"
                  multiple
                  onChange={(event) => {
                    if (event.target.files?.length) void handleFiles(event.target.files);
                  }}
                  className="block w-full max-w-sm rounded-lg border bg-white p-2"
                />
              </div>

              <div className="rounded-xl border p-4">
                <p className="mb-3 text-sm text-slate-600">
                  ייבוא דרך Browser Contacts API (זמין רק ב-Chrome ב-Android).
                </p>
                <button
                  disabled={!canUseBrowserApi || running}
                  onClick={importFromBrowser}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  ייבוא מאנשי הקשר בדפדפן
                </button>
                {!canUseBrowserApi ? (
                  <p className="mt-2 text-sm text-amber-700">הדפדפן הנוכחי לא תומך ב-Browser Contacts API.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "paste" ? (
            <div className="grid gap-3">
              <p className="text-sm text-slate-600">
                הדבק רשימה - שורה לכל איש קשר. ניתן להדביק שמות + טלפונים מ-WhatsApp, Excel, או טקסט חופשי.
              </p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={"לדוגמה:\nישראל ישראל 050-1234567\n054-1111111 דוד כהן\nאהרון לוי, +972527654321"}
                rows={10}
                className="w-full rounded-lg border p-3 font-mono text-sm"
              />
              <div className="flex justify-end">
                <button
                  onClick={handlePasteParse}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                >
                  נתח רשימה
                </button>
              </div>
            </div>
          ) : null}

          {tab === "manual" ? (
            <div className="grid gap-3">
              <p className="text-sm text-slate-600">הוסף איש קשר אחד או יותר באופן ידני.</p>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="שם מלא"
                  className="rounded-lg border p-2 text-sm"
                />
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="טלפון (ניתן כמה מופרדים בפסיק)"
                  className="rounded-lg border p-2 text-sm"
                />
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="אימייל (אופציונלי)"
                  className="rounded-lg border p-2 text-sm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleManualAdd}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                >
                  הוסף לרשימה
                </button>
              </div>
            </div>
          ) : null}

          {info && !error ? <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{info}</p> : null}
          {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

          {parsed.length > 0 ? (
            <div className="rounded-xl border">
              <div className="flex items-center justify-between gap-3 border-b p-3">
                <p className="text-sm text-slate-600">
                  תצוגה מקדימה: {previewRows.length} מתוך {parsed.length}
                </p>
                <button
                  onClick={runImport}
                  disabled={running}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  {running ? "מייבא..." : `ייבא ${parsed.length} אנשי קשר`}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">שם</th>
                      <th className="px-3 py-2 text-right font-medium">טלפון</th>
                      <th className="px-3 py-2 text-right font-medium">אימייל</th>
                      <th className="px-3 py-2 text-right font-medium">מקור</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{row.fullName}</td>
                        <td className="px-3 py-2 text-slate-600">{row.phones.join(", ") || "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{row.email ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-500">{row.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {running && progress.total > 0 ? (
            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm text-slate-700">
                התקדמות: {progress.done}/{progress.total}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {summary ? (
            <div className="rounded-xl border bg-slate-50 p-4">
              <h3 className="mb-2 font-semibold text-slate-800">סיכום ייבוא</h3>
              <ul className="grid gap-1 text-sm text-slate-700">
                <li>נוספו: {summary.imported}</li>
                <li>דולגו (כפילויות): {summary.skippedDuplicates}</li>
                <li>נכשלו: {summary.failed}</li>
              </ul>
              {summary.errors.length > 0 ? (
                <details className="mt-2 text-xs text-rose-700">
                  <summary className="cursor-pointer">פרטי שגיאות ({summary.errors.length})</summary>
                  <ul className="mt-1 list-disc pr-4">
                    {summary.errors.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
        active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}
