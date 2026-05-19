"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { LazyScrollList } from "@/components/lazy-scroll-list";
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
import type { PhoneDuplicateMatch } from "@/lib/duplicate-contacts";
import { collectNormalizedPhones } from "@/lib/duplicate-contacts";
import {
  addInsertedToPhoneIndex,
  fetchContactsOverlappingPhones,
  filterImportBatch,
  mergePhoneIndex,
} from "@/lib/import-duplicate-check";
import { formatContactSource, translateApiError } from "@/lib/labels";
import { btnSecondary, btnSuccess } from "@/lib/ui";
import { supabase } from "@/lib/supabase/client";
import type { ImportedContact } from "@/lib/contacts-import";

const BATCH_SIZE = 12;
const BATCH_DELAY_MS = 350;
const SINGLE_ROW_DELAY_MS = 120;
const CHUNK_IMPORT_SIZE = 50;
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

  async function runImport(maxCount?: number) {
    if (!parsed.length || running) return;
    const queue = maxCount ? parsed.slice(0, maxCount) : parsed;
    setRunning(true);
    setError("");
    setSummary(null);
    setProgress({ done: 0, total: queue.length });

    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const duplicateDetails: DuplicateSkip[] = [];
    let phoneIndex = new Map<string, PhoneDuplicateMatch>();

    try {
      for (let i = 0; i < queue.length; i += BATCH_SIZE) {
        const batch = queue.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        const batchPhones = batch.flatMap((row) => collectNormalizedPhones(row.phones));
        const overlapRes = await withRateLimitRetry(async () => {
          try {
            const rows = await fetchContactsOverlappingPhones(batchPhones);
            return { data: rows, error: null as SupabaseErrorLike | null };
          } catch (err) {
            return { data: null, error: { message: (err as Error).message } };
          }
        });
        if (overlapRes.error) {
          throw new Error(translateApiError(overlapRes.error.message ?? "שגיאה בבדיקת כפילויות"));
        }
        phoneIndex = mergePhoneIndex(phoneIndex, overlapRes.data ?? []);

        const { toInsert, skipped: batchSkipped } = filterImportBatch(batch, phoneIndex);
        for (const dup of batchSkipped) {
          skipped += 1;
          if (dup.contactId !== "pending") {
            duplicateDetails.push({
              name: dup.fullName,
              contactId: dup.contactId,
              phone: dup.matchedPhone,
            });
          }
        }

        if (!toInsert.length) {
          setProgress({ done: skipped + imported + failed, total: queue.length });
          if (i + BATCH_SIZE < queue.length) await sleep(BATCH_DELAY_MS);
          continue;
        }

        const payload = toInsert.map((row) => ({
          externalContactId: row.externalContactId ?? null,
          fullName: row.fullName,
          phones: row.phones,
          email: row.email ?? null,
          source: row.source,
        }));

        const insertedIds = await insertContactsBatch(payload, batchNum, errors);
        if (!insertedIds.length) {
          failed += toInsert.length;
          setProgress({ done: skipped + imported + failed, total: queue.length });
          if (i + BATCH_SIZE < queue.length) await sleep(BATCH_DELAY_MS);
          continue;
        }

        addInsertedToPhoneIndex(phoneIndex, toInsert, insertedIds);

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
        failed += toInsert.length - insertedIds.length;
        setProgress({ done: skipped + imported + failed, total: queue.length });

        if (i + BATCH_SIZE < queue.length) await sleep(BATCH_DELAY_MS);
      }

      setSummary({ imported, skippedDuplicates: skipped, duplicateDetails, failed, errors });
      setParsed((prev) => (maxCount ? prev.slice(queue.length) : []));
      if (!maxCount && fileInputRef.current) fileInputRef.current.value = "";
      if (maxCount && parsed.length <= queue.length && fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (e) {
      setError(translateApiError((e as Error).message));
    } finally {
      setRunning(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">ייבוא אנשי קשר</h2>
            {(parsed.length > 0 || summary) && (
              <button
                onClick={reset}
                className="rounded-lg border px-3 py-2 text-sm text-ink-mid hover:bg-cream"
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
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-cream p-6 text-center text-sm text-ink-mid"
              >
                <p>גרור לכאן קבצים או בחר ידנית</p>
                <p className="text-xs text-ink-light">
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
                <p className="mb-3 text-sm text-ink-mid">
                  ייבוא דרך ממשק אנשי הקשר של הדפדפן (זמין בכרום באנדרואיד בלבד).
                </p>
                <button
                  disabled={!canUseBrowserApi || running}
                  onClick={importFromBrowser}
                  className="rounded-lg bg-navy px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-slate-300"
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
              <p className="text-sm text-ink-mid">
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
                  className="rounded-lg bg-navy px-4 py-2 text-sm text-white hover:bg-navy-light"
                >
                  נתח רשימה
                </button>
              </div>
            </div>
          ) : null}

          {tab === "manual" ? (
            <div className="grid gap-3">
              <p className="text-sm text-ink-mid">הוסף איש קשר אחד או יותר באופן ידני.</p>
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
                  className="rounded-lg bg-navy px-4 py-2 text-sm text-white hover:bg-navy-light"
                >
                  הוסף לרשימה
                </button>
              </div>
            </div>
          ) : null}

          {info && !error ? <p className="rounded-lg bg-gold-pale p-3 text-sm text-navy">{info}</p> : null}
          {error ? <p className="rounded-lg bg-danger-pale p-3 text-sm text-danger">{error}</p> : null}

          {parsed.length > 0 ? (
            <div className="rounded-xl border">
              <div className="grid gap-3 border-b p-3">
                <p className="text-sm text-ink-mid">
                  התצוגה נטענת בהדרגה בגלילה (25 שורות בכל פעם). בדיקת כפילויות לפי אצוות.
                </p>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => void runImport()}
                    disabled={running}
                    className={btnSuccess}
                  >
                    {running ? "מייבא..." : `ייבא הכל (${parsed.length})`}
                  </button>
                  {parsed.length > CHUNK_IMPORT_SIZE ? (
                    <button
                      type="button"
                      onClick={() => void runImport(CHUNK_IMPORT_SIZE)}
                      disabled={running}
                      className={btnSecondary}
                    >
                      ייבא {CHUNK_IMPORT_SIZE} ראשונים
                    </button>
                  ) : null}
                </div>
              </div>
              <LazyScrollList
                items={parsed}
                getKey={(row, i) => makeContactKey(row.fullName, row.phones, row.email) + String(i)}
                renderItem={(row) => (
                  <div className="grid gap-1 px-3 py-3 text-sm md:grid-cols-4 md:gap-2">
                    <p className="font-medium text-ink">{row.fullName}</p>
                    <p className="text-ink-mid">{row.phones.join(", ") || "—"}</p>
                    <p className="text-ink-mid">{row.email ?? "—"}</p>
                    <p className="text-ink-light">{formatContactSource(row.source)}</p>
                  </div>
                )}
              />
            </div>
          ) : null}

          {running && progress.total > 0 ? (
            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm text-ink-mid">
                התקדמות: {progress.done}/{progress.total}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-navy transition-all"
                  style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {summary ? (
            <div className="rounded-xl border bg-cream p-4">
              <h3 className="mb-2 font-semibold text-ink">סיכום ייבוא</h3>
              <ul className="grid gap-1 text-sm text-ink-mid">
                <li>נוספו: {summary.imported}</li>
                <li>דולגו (כפילויות): {summary.skippedDuplicates}</li>
                <li>נכשלו: {summary.failed}</li>
              </ul>
              {summary.duplicateDetails.length > 0 ? (
                <ul className="mt-2 grid gap-1 text-sm text-amber-800">
                  {summary.duplicateDetails.slice(0, 20).map((dup, i) => (
                    <li key={`${dup.contactId}-${dup.phone}-${i}`}>
                      טלפון {dup.phone} כבר קיים:{" "}
                      <a href={`/potentials/${dup.contactId}`} className="font-medium text-navy underline">
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
                <details className="mt-2 text-xs text-danger">
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
          ? "bg-navy text-white md:border-indigo-600 md:bg-transparent md:text-navy"
          : "bg-navy-pale text-ink-mid md:border-transparent md:bg-transparent md:text-ink-mid"
      }`}
    >
      {children}
    </button>
  );
}
