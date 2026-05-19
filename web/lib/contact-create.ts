import { normalizePhone } from "@/lib/contacts-import";
import type { ContactSource } from "@/lib/types";

export function buildFullName(firstName: string, lastName?: string): string {
  return [firstName.trim(), (lastName ?? "").trim()].filter(Boolean).join(" ");
}

export function parsePhoneInput(phone: string): string[] {
  return phone
    .split(/[,;\s]+/)
    .map((p) => normalizePhone(p.trim()))
    .filter(Boolean) as string[];
}

export interface CreateContactInput {
  fullName: string;
  phones: string[];
  email?: string | null;
  source?: ContactSource;
  externalContactId?: string | null;
}
