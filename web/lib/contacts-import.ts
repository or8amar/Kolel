import type { ContactSource } from "@/lib/types";

export interface ImportedContact {
  externalContactId?: string;
  fullName: string;
  phones: string[];
  email?: string;
  source: ContactSource;
}

export async function importFromBrowserContacts(): Promise<ImportedContact[]> {
  if (!("contacts" in navigator) || !("ContactsManager" in window)) {
    throw new Error("ממשק אנשי הקשר של הדפדפן לא נתמך בדפדפן זה.");
  }

  const contacts = await (navigator as Navigator & { contacts: ContactsManager }).contacts.select(["name", "email", "tel"], {
    multiple: true,
  });

  return contacts
    .map((item) => ({
      fullName: item.name?.[0]?.trim() ?? "",
      phones: dedupeStrings((item.tel ?? []).map(normalizePhone).filter(Boolean) as string[]),
      email: item.email?.[0],
      source: "browser_contacts" as const,
    }))
    .filter((c) => c.fullName.length > 0);
}

export function parseCsvContacts(content: string): ImportedContact[] {
  const cleaned = stripBom(content);
  const rows = parseCsvRows(cleaned);
  return rowsToContacts(rows, "csv");
}

export function parseJsonContacts(content: string): ImportedContact[] {
  let data: unknown;
  try {
    data = JSON.parse(stripBom(content));
  } catch {
    throw new Error("קובץ JSON לא תקין.");
  }
  const records = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : Array.isArray((data as { contacts?: unknown }).contacts)
    ? ((data as { contacts: Record<string, unknown>[] }).contacts)
    : [];

  if (!records.length) return [];

  const out: ImportedContact[] = [];
  for (const row of records) {
    const fullName = pickFirstString(row, [
      "fullname",
      "full_name",
      "name",
      "displayname",
      "display_name",
      "שם",
    ]);
    if (!fullName) continue;
    const phones = collectPhones(row);
    const email = pickFirstString(row, ["email", "e-mail", "mail", "אימייל"]);
    const item: ImportedContact = {
      fullName,
      phones,
      source: "csv",
    };
    if (email) item.email = email;
    out.push(item);
  }

  return dedupeImported(out);
}

export async function parseExcelContacts(file: File): Promise<ImportedContact[]> {
  const xlsx = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: "array" });
  const all: ImportedContact[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false });
    const normalized = rows.map((row) => row.map((cell) => (cell ?? "").toString()));
    all.push(...rowsToContacts(normalized, "csv"));
  }
  return dedupeImported(all);
}

/** Normalize CR/LF so pasted lists from Excel/WhatsApp split into one row per contact. */
export function normalizeImportText(text: string): string {
  return stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Extract phone-like tokens without nested quantifiers that can blow the stack on long lines. */
const PASTED_PHONE_PATTERN =
  /(?:\+972|0)(?:[\s\-().]*\d){8,12}|\+?\d[\d\s\-().]{6,}\d|(?<!\d)\d{9,10}(?!\d)/g;

/** True when a token looks like a phone number (incl. Israeli numbers without a leading 0). */
function looksLikePhoneToken(raw: string, normalized: string): boolean {
  if (normalized.length < 7 || normalized.length > 15) return false;
  if (!/^\+?\d+$/.test(normalized)) return false;
  return /[\d]/.test(raw);
}

/** Parse Excel-style tab rows: firstName, lastName, phone (or name + phone). */
export function parseTabSeparatedLine(line: string): ImportedContact | null {
  if (!/\t/.test(line)) return null;

  const cols = line.split("\t").map((c) => c.trim());
  while (cols.length > 0 && !cols[cols.length - 1]) cols.pop();
  if (cols.length < 2) return null;

  const lastCol = cols[cols.length - 1] ?? "";
  const lastNormalized = normalizePhone(lastCol);
  const lastIsPhone = looksLikePhoneToken(lastCol, lastNormalized);

  const phones: string[] = [];
  let nameParts: string[];

  if (cols.length >= 3 || (cols.length === 2 && lastIsPhone)) {
    if (lastIsPhone) {
      phones.push(lastNormalized);
      nameParts = cols.slice(0, -1);
    } else {
      nameParts = cols;
    }
  } else {
    nameParts = cols;
  }

  const fullName = nameParts.filter(Boolean).join(" ").trim();
  if (!fullName && !phones.length) return null;

  return {
    fullName: fullName || phones[0] || "",
    phones: dedupeStrings(phones),
    source: "manual",
  };
}

export function parsePastedText(text: string): ImportedContact[] {
  const lines = normalizeImportText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ImportedContact[] = [];
  for (const line of lines) {
    const tabbed = parseTabSeparatedLine(line);
    if (tabbed) {
      out.push(tabbed);
      continue;
    }

    const phones: string[] = [];
    for (const match of line.matchAll(PASTED_PHONE_PATTERN)) {
      const normalized = normalizePhone(match[0]);
      if (normalized.length >= 7) phones.push(normalized);
    }

    let nameAccum = line;
    if (phones.length) {
      nameAccum = line.replace(PASTED_PHONE_PATTERN, " ");
    }
    const fullName = nameAccum
      .replace(/[,\t;:|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const finalName = fullName || phones[0] || "";
    if (!finalName) continue;

    out.push({
      fullName: finalName,
      phones: dedupeStrings(phones),
      source: "manual",
    });
  }

  return dedupeImported(out);
}

export function parseVcfContacts(content: string): ImportedContact[] {
  const unfolded = stripBom(content).replace(/\r?\n[ \t]/g, "");
  const cards = unfolded.split(/END:VCARD/i).map((card) => card.trim()).filter(Boolean);

  return dedupeImported(
    cards
      .map((card) => {
        const fullName = matchFirst(card, /^FN(?:[^:\n]*)?:(.+)$/im) ?? buildVcfName(card);
        const emails = matchAll(card, /^EMAIL(?:[^:\n]*)?:(.+)$/gim);
        const phones = matchAll(card, /^TEL(?:[^:\n]*)?:(.+)$/gim).map(normalizePhone).filter(Boolean) as string[];
        return {
          fullName: (fullName ?? "").trim(),
          email: emails[0]?.trim(),
          phones: dedupeStrings(phones),
          source: "vcf" as const,
        };
      })
      .filter((c) => c.fullName.length > 0),
  );
}

export function buildManualContact(input: { fullName: string; phones?: string[]; email?: string }): ImportedContact {
  return {
    fullName: input.fullName.trim(),
    phones: dedupeStrings((input.phones ?? []).map(normalizePhone).filter(Boolean) as string[]),
    email: input.email?.trim() || undefined,
    source: "manual",
  };
}

function rowsToContacts(rows: string[][], source: ContactSource): ImportedContact[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => (h ?? "").toString().trim());
  const lowered = headers.map((h) => h.toLowerCase());

  const findIndex = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = lowered.indexOf(c.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const fullNameIdx = findIndex(
    "name",
    "full_name",
    "fullname",
    "full name",
    "display name",
    "displayname",
    "שם מלא",
    "שם",
  );
  const givenNameIdx = findIndex("given name", "first name", "firstname", "שם פרטי");
  const familyNameIdx = findIndex("family name", "last name", "lastname", "surname", "שם משפחה");

  const phoneIndexes: number[] = [];
  const emailIndexes: number[] = [];
  for (let i = 0; i < lowered.length; i += 1) {
    const h = lowered[i];
    const isMeta = /(type|label|primary|country|protocol)/.test(h);
    if (!isMeta && /(phone|tel|mobile|cell|fax|טלפון|סלולרי|נייד)/.test(h)) {
      phoneIndexes.push(i);
      continue;
    }
    if (!isMeta && /(e[-\s]?mail|דוא[\"׳']ל|אימייל|מייל)/.test(h)) {
      emailIndexes.push(i);
    }
  }

  const out: ImportedContact[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cols = rows[r] ?? [];
    if (!cols.some((c) => c && c.toString().trim().length)) continue;

    let fullName = "";
    if (fullNameIdx >= 0) fullName = (cols[fullNameIdx] ?? "").toString().trim();
    if (!fullName) {
      const given = givenNameIdx >= 0 ? (cols[givenNameIdx] ?? "").toString().trim() : "";
      const family = familyNameIdx >= 0 ? (cols[familyNameIdx] ?? "").toString().trim() : "";
      fullName = [given, family].filter(Boolean).join(" ").trim();
    }
    if (!fullName) continue;

    const phones: string[] = [];
    for (const idx of phoneIndexes) {
      const cell = (cols[idx] ?? "").toString();
      if (!cell) continue;
      for (const piece of cell.split(/[;:|,]/)) {
        const normalized = normalizePhone(piece);
        if (normalized) phones.push(normalized);
      }
    }

    let email: string | undefined;
    for (const idx of emailIndexes) {
      const cell = (cols[idx] ?? "").toString().trim();
      if (cell) {
        email = cell.split(/[;\s]+/)[0];
        break;
      }
    }

    out.push({
      fullName,
      phones: dedupeStrings(phones),
      email,
      source,
    });
  }

  return dedupeImported(out);
}

function pickFirstString(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    for (const candidate of [key, key.toLowerCase(), key.toUpperCase()]) {
      const v = row[candidate];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  for (const k of Object.keys(row)) {
    if (keys.some((wanted) => k.toLowerCase() === wanted.toLowerCase())) {
      const v = row[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}

function collectPhones(row: Record<string, unknown>): string[] {
  const out: string[] = [];
  const candidates = [
    "phone",
    "phones",
    "tel",
    "mobile",
    "cell",
    "phoneNumber",
    "phone_number",
    "mobilePhone",
    "homePhone",
    "businessPhone",
    "טלפון",
    "סלולרי",
    "נייד",
  ];
  for (const key of Object.keys(row)) {
    if (candidates.some((c) => key.toLowerCase().includes(c.toLowerCase()))) {
      const v = row[key];
      if (typeof v === "string") {
        for (const piece of v.split(/[;,|]/)) {
          const normalized = normalizePhone(piece);
          if (normalized) out.push(normalized);
        }
      } else if (Array.isArray(v)) {
        for (const item of v as unknown[]) {
          if (typeof item === "string") {
            const normalized = normalizePhone(item);
            if (normalized) out.push(normalized);
          }
        }
      }
    }
  }
  return dedupeStrings(out);
}

function buildVcfName(card: string): string | undefined {
  const n = matchFirst(card, /^N(?:[^:\n]*)?:(.+)$/im);
  if (!n) return undefined;
  const parts = n.split(";").map((p) => p.trim()).filter(Boolean);
  return parts.reverse().join(" ");
}

function matchFirst(text: string, regex: RegExp): string | undefined {
  return text.match(regex)?.[1]?.trim();
}

function matchAll(text: string, regex: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

export function normalizePhone(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/[^\d+]/g, "").trim();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const k = v.trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function dedupeImported(items: ImportedContact[]): ImportedContact[] {
  const seen = new Set<string>();
  const out: ImportedContact[] = [];
  for (const c of items) {
    const key = makeContactKey(c.fullName, c.phones, c.email);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function makeContactKey(fullName: string, phones: string[] | null | undefined, email?: string | null): string {
  const phoneKey = (phones ?? []).map(normalizePhone).filter(Boolean).sort().join("|");
  const emailKey = (email ?? "").toLowerCase().trim();
  return `${fullName.trim().toLowerCase()}::${phoneKey}::${emailKey}`;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 0 && r.some((c) => c.length > 0));
}

declare global {
  interface ContactsManager {
    select(
      properties: Array<"name" | "email" | "tel" | "address" | "icon">,
      options?: { multiple?: boolean },
    ): Promise<Array<{ name?: string[]; email?: string[]; tel?: string[] }>>;
  }
}
