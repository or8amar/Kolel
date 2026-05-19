import {
  buildPhoneIndex,
  collectNormalizedPhones,
  findPhoneDuplicate,
  type ContactPhoneLookup,
  type PhoneDuplicateMatch,
} from "@/lib/duplicate-contacts";
import { supabase } from "@/lib/supabase/client";

/** טוען מהמסד רק אנשי קשר עם טלפון חופף לאצווה — במקום לטעון את כל הטבלה. */
export async function fetchContactsOverlappingPhones(
  phones: string[],
): Promise<ContactPhoneLookup[]> {
  const unique = [...new Set(phones.filter(Boolean))];
  if (!unique.length) return [];

  const { data, error } = await supabase
    .from("contacts")
    .select("id, fullName, phones")
    .overlaps("phones", unique);

  if (error) throw new Error(error.message);
  return (data as ContactPhoneLookup[]) ?? [];
}

export function mergePhoneIndex(
  base: Map<string, PhoneDuplicateMatch>,
  contacts: ContactPhoneLookup[],
): Map<string, PhoneDuplicateMatch> {
  const merged = new Map(base);
  for (const [phone, match] of buildPhoneIndex(contacts)) {
    if (!merged.has(phone)) merged.set(phone, match);
  }
  return merged;
}

export function filterImportBatch<T extends { phones: string[]; fullName: string }>(
  batch: T[],
  phoneIndex: Map<string, PhoneDuplicateMatch>,
): { toInsert: T[]; skipped: PhoneDuplicateMatch[] } {
  const toInsert: T[] = [];
  const skipped: PhoneDuplicateMatch[] = [];
  const sessionIndex = new Map(phoneIndex);

  for (const row of batch) {
    const dup = findPhoneDuplicate(row.phones, sessionIndex);
    if (dup) {
      skipped.push(dup);
      continue;
    }
    toInsert.push(row);
    for (const phone of collectNormalizedPhones(row.phones)) {
      sessionIndex.set(phone, {
        contactId: "pending",
        fullName: row.fullName,
        matchedPhone: phone,
      });
    }
  }
  return { toInsert, skipped };
}

export function addInsertedToPhoneIndex(
  index: Map<string, PhoneDuplicateMatch>,
  rows: { fullName: string; phones: string[] }[],
  insertedIds: string[],
): void {
  rows.forEach((row, i) => {
    const id = insertedIds[i];
    if (!id) return;
    for (const phone of collectNormalizedPhones(row.phones)) {
      index.set(phone, { contactId: id, fullName: row.fullName, matchedPhone: phone });
    }
  });
}
