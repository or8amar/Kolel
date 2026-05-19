import { normalizePhone } from "@/lib/contacts-import";

export interface ContactPhoneLookup {
  id: string;
  fullName: string;
  phones: string[] | null;
}

export interface PhoneDuplicateMatch {
  contactId: string;
  fullName: string;
  matchedPhone: string;
}

/** Build map: normalized phone → first contact that owns it. */
export function buildPhoneIndex(contacts: ContactPhoneLookup[]): Map<string, PhoneDuplicateMatch> {
  const index = new Map<string, PhoneDuplicateMatch>();
  for (const contact of contacts) {
    for (const raw of contact.phones ?? []) {
      const phone = normalizePhone(raw);
      if (!phone || index.has(phone)) continue;
      index.set(phone, {
        contactId: contact.id,
        fullName: contact.fullName,
        matchedPhone: phone,
      });
    }
  }
  return index;
}

export function findPhoneDuplicate(
  phones: string[],
  index: Map<string, PhoneDuplicateMatch>,
): PhoneDuplicateMatch | null {
  for (const raw of phones) {
    const phone = normalizePhone(raw);
    if (!phone) continue;
    const match = index.get(phone);
    if (match) return match;
  }
  return null;
}

export function collectNormalizedPhones(phones: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of phones) {
    const phone = normalizePhone(raw);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push(phone);
  }
  return out;
}
