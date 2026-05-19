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
import { buildPhoneIndex, findPhoneDuplicate, type ContactPhoneLookup } from "@/lib/duplicate-contacts";
import { formatContactSource, translateApiError } from "@/lib/labels";
import { supabase } from "@/lib/supabase/client";
import type { ImportedContact } from "@/lib/contacts-import";

const BATCH_SIZE = 12;
const BATCH_DELAY_MS = 350;
const SINGLE_ROW_DELAY_MS = 120;
const EXISTING_PAGE_SIZE = 1000;
const RATE_LIMIT_MAX_RETRIES = 6;
const RATE_LIMIT_INITIAL_BACKOFF_MS = 1000;
const RATE_LIMIT_MAX_BACKOFF_MS = 16000;

type TabKey = "files" | "paste" | "manual";

interface DuplicateSkip {
  name: string;
  contactId: string;
  phone: string;
}

interface ImportSummary {
  imported: number;
  skippedDuplicates: number;
  duplicateDetails: DuplicateSkip[];
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
          setError(`קובץ לא נתמך: ${file.name}. נתמכים: CSV, VCF, Excel ‏(XLSX/XLS)‏ ו-JSON.`);
          return;
        }
      }
    } catch (e) {
      setError(translateApiError((e as Error).message));
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
    try {
      const rows = parsePastedText(pastedText);
      applyParsed(rows);
    } catch (e) {
      setError(translateApiError((e as Error).message || "שגיאה בניתוח הרשימה."));
    }
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
      setError(translateApiError((e as Error).message));
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
      const existingKeys = new Set<string>();
      const existingContacts: ContactPhoneLookup[] = [];
      for (let from = 0; ; from += EXISTING_PAGE_SIZE) {
        const { data: page, error: existingError } = await withRateLimitRetry(async () =>
          await supabase
            .from("contacts")
            .select("id, fullName, phones, email")
            .range(from, from + EXISTING_PAGE_SIZE - 1),
        );
        if (existingError) throw new Error(translateApiError(existingError.message ?? "שגיאה בטעינת אנשי קשר קיימים"));
        const rows = page ?? [];
        for (const c of rows) {
          const row = c as ContactPhoneLookup & { email?: string | null };
          existingContacts.push(row);
          existingKeys.add(
            makeContactKey(row.fullName ?? "", row.phones ?? [], row.email ?? null),
          );
        }
        if (rows.length < EXISTING_PAGE_SIZE) break;
      }

      const phoneIndex = buildPhoneIndex(existingContacts);
      const duplicateDetails: DuplicateSkip[] = [];
      const toInsert: ImportedContact[] = [];

      for (const c of parsed) {
        const phoneDup = findPhoneDuplicate(c.phones, phoneIndex);
        if (phoneDup) {
          skipped += 1;
          duplicateDetails.push({
            name: phoneDup.fullName,
            contactId: phoneDup.contactId,
            phone: phoneDup.matchedPhone,
          });
          continue;
        }
        if (existingKeys.has(makeContactKey(c.fullName, c.phones, c.email))) {
          skipped += 1;
          continue;
        }
        toInsert.push(c);
      }

      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const payload = batch.map((row) => ({
          externalContactId: row.externalContactId ?? null,
          fullName: row.fullName,
          phones: row.phones,
          email: row.email ?? null,
          source: row.source,
        }));

        const insertedIds = await insertContactsBatch(payload, batchNum, errors);
        if (!insertedIds.length) {
          failed += batch.length;
          setProgress({ done: skipped + imported + failed, total: parsed.length });
          if (i + BATCH_SIZE < toInsert.length) await sleep(BATCH_DELAY_MS);
          continue;
        }

        const potentialsPayload = insertedIds.map((contactId) => ({
          contactId,
          status: "new" as const,
          notes: null,
          nextFollowUpAt: new Date().toISOString(),
        }));

        if (potentialsPayload.length) {
          const potError = await insertPotentialsBatch(potentialsPayload, batchNum, errors);
          if (potError) {
            errors.push(`קבוצה ${batchNum}: שגיאה ביצירת פוטנציאלים — ${translateApiError(potError.message ?? "")}`);
          }
        }

        imported += insertedIds.length;
        failed += batch.length - insertedIds.length;
        setProgress({ done: skipped + imported + failed, total: parsed.length });

        if (i + BATCH_SIZE < toInsert.length) await sleep(BATCH_DELAY_MS);
      }

      setSummary({ imported, skippedDuplicates: skipped, duplicateDetails, failed, errors });
      setParsed([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(translateApiError((e as Error).message));
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

          <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:border-b">
            <TabBtn active={tab === "files"} onClick={() => setTab("files")}>
              מקבצים
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
                  נתמכים: ייצוא מגוגל או אאוטלוק (CSV), כרטיסי איש קשר (VCF, כולל וואטסאפ), Excel (.xlsx/.xls), JSON
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
                  ייבוא דרך ממשק אנשי הקשר של הדפדפן (זמין בכרום באנדרואיד בלבד).
                </p>
                <button
                  disabled={!canUseBrowserApi || running}
                  onClick={importFromBrowser}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  ייבוא מאנשי הקשר בדפדפן
                </button>
                {!canUseBrowserApi ? (
                  <p className="mt-2 text-sm text-amber-700">הדפדפן הנוכחי לא תומך בממשק אנשי הקשר של הדפדפן.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "paste" ? (
            <div className="grid gap-3">
              <p className="text-sm text-slate-600">
                הדבק רשימה — שורה לכל איש קשר. ניתן להדביק מאקסל (עמודות מופרדות בטאב: שם פרטי, שם משפחה,
                טלפון), מוואטסאפ, או טקסט חופשי.
              </p>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={
                  "לדוגמה (טאבים בין עמודות מאקסל):\nשמואל\tעזרן\t546671443\nישראל\tישראלי\t0501234567\n\nאו טקסט חופשי:\nדוד כהן 054-1111111"
                }
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
                        <td className="px-3 py-2 text-slate-500">{formatContactSource(row.source)}</td>
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
              {summary.duplicateDetails.length > 0 ? (
                <ul className="mt-2 grid gap-1 text-sm text-amber-800">
                  {summary.duplicateDetails.slice(0, 20).map((dup, i) => (
                    <li key={`${dup.contactId}-${dup.phone}-${i}`}>
                      טלפון {dup.phone} כבר קיים:{" "}
                      <a href={`/potentials/${dup.contactId}`} className="font-medium text-indigo-600 underline">
                        {dup.name}
                      </a>
                    </li>
                  ))}
                  {summary.duplicateDetails.length > 20 ? (
                    <li>ועוד {summary.duplicateDetails.length - 20} כפילויות...</li>
                  ) : null}
                </ul>
              ) : null}
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

type ContactInsertPayload = {
  externalContactId: string | null;
  fullName: string;
  phones: string[];
  email: string | null;
  source: ImportedContact["source"];
};

type PotentialInsertPayload = {
  contactId: string;
  status: "new";
  notes: null;
  nextFollowUpAt: string;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.status === 429 ||
    error.code === "429" ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("over_request_rate_limit")
  );
}

async function withRateLimitRetry<T>(
  operation: () => Promise<{ data: T | null; error: SupabaseErrorLike | null }>,
): Promise<{ data: T | null; error: SupabaseErrorLike | null }> {
  let backoff = RATE_LIMIT_INITIAL_BACKOFF_MS;
  let result = await operation();

  for (let attempt = 0; attempt < RATE_LIMIT_MAX_RETRIES && isRateLimitError(result.error); attempt += 1) {
    await sleep(backoff);
    backoff = Math.min(backoff * 2, RATE_LIMIT_MAX_BACKOFF_MS);
    result = await operation();
  }

  return result;
}

async function insertContactsBatch(
  payload: ContactInsertPayload[],
  batchNum: number,
  errors: string[],
  isRetry = false,
): Promise<string[]> {
  const { data: inserted, error: insertError } = await withRateLimitRetry(async () =>
    await supabase.from("contacts").insert(payload).select("id"),
  );

  if (!insertError) {
    return (inserted ?? []).map((item) => (item as { id: string }).id);
  }

  if (isRateLimitError(insertError)) {
    errors.push(`קבוצה ${batchNum}: מגבלת קצב (נסיונות חוזרים נכשלו) — ${translateApiError(insertError.message ?? "")}`);
    return [];
  }

  if (payload.length === 1) {
    errors.push(`קבוצה ${batchNum}: ${translateApiError(insertError.message ?? "")}`);
    return [];
  }

  const ids: string[] = [];
  for (const row of payload) {
    ids.push(...(await insertContactsBatch([row], batchNum, errors, true)));
    await sleep(SINGLE_ROW_DELAY_MS);
  }
  if (!ids.length && !isRetry) {
    errors.push(`קבוצה ${batchNum}: ${translateApiError(insertError.message ?? "")}`);
  }
  return ids;
}

async function insertPotentialsBatch(
  payload: PotentialInsertPayload[],
  batchNum: number,
  errors: string[],
): Promise<SupabaseErrorLike | null> {
  const { error } = await withRateLimitRetry(async () =>
    await supabase.from("payment_potentials").insert(payload),
  );
  if (error && isRateLimitError(error)) {
    errors.push(`קבוצה ${batchNum}: מגבלת קצב ביצירת פוטנציאלים - ${error.message}`);
  }
  return error;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-lg px-2 py-2 text-sm font-medium transition md:min-h-0 md:flex-none md:rounded-none md:border-b-2 md:px-3 ${
        active
          ? "bg-indigo-600 text-white md:border-indigo-600 md:bg-transparent md:text-indigo-700"
          : "bg-slate-100 text-slate-700 md:border-transparent md:bg-transparent md:text-slate-600"
      }`}
    >
      {children}
    </button>
  );
}
