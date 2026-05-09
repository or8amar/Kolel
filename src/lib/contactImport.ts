import type { ContactInput, ContactStatus } from "../types";

const DEFAULT_STATUS: ContactStatus = "new";

export async function importFromBrowserContacts(): Promise<ContactInput[]> {
  if (!("contacts" in navigator) || !("ContactsManager" in window)) {
    throw new Error("Browser Contacts API לא נתמך בדפדפן זה");
  }

  // Browser Contacts API is still experimental and requires user permission.
  const selected = await (navigator as Navigator & { contacts: ContactsManager }).contacts.select(
    ["name", "email", "tel"],
    { multiple: true },
  );

  return selected
    .map((item) => ({
      full_name: item.name?.[0] ?? "",
      email: item.email?.[0],
      phone: item.tel?.[0],
      source: "browser_contacts" as const,
      status: DEFAULT_STATUS,
      follow_up_required: true,
    }))
    .filter((item) => item.full_name.trim().length > 0);
}

export function parseContactsCsv(content: string): ContactInput[] {
  const [headerLine, ...rows] = content.split(/\r?\n/).filter(Boolean);
  if (!headerLine) return [];

  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => ["name", "full_name", "full name"].includes(h));
  const emailIdx = headers.findIndex((h) => h === "email");
  const phoneIdx = headers.findIndex((h) => ["phone", "tel", "mobile"].includes(h));

  return rows
    .map((line) => line.split(",").map((v) => v.trim()))
    .map((cols) => ({
      full_name: cols[nameIdx] ?? "",
      email: emailIdx >= 0 ? cols[emailIdx] : undefined,
      phone: phoneIdx >= 0 ? cols[phoneIdx] : undefined,
      source: "csv" as const,
      status: DEFAULT_STATUS,
      follow_up_required: true,
    }))
    .filter((item) => item.full_name.trim().length > 0);
}

export function parseContactsVcf(content: string): ContactInput[] {
  const cards = content.split("END:VCARD").map((card) => card.trim()).filter(Boolean);

  return cards
    .map((card) => {
      const fn = card.match(/FN:(.+)/i)?.[1]?.trim();
      const email = card.match(/EMAIL[^:]*:(.+)/i)?.[1]?.trim();
      const phone = card.match(/TEL[^:]*:(.+)/i)?.[1]?.trim();
      return {
        full_name: fn ?? "",
        email,
        phone,
        source: "vcf" as const,
        status: DEFAULT_STATUS,
        follow_up_required: true,
      };
    })
    .filter((item) => item.full_name.trim().length > 0);
}

declare global {
  interface ContactsManager {
    select(
      properties: Array<"name" | "email" | "tel" | "address" | "icon">,
      options?: { multiple?: boolean },
    ): Promise<
      Array<{
        name?: string[];
        email?: string[];
        tel?: string[];
      }>
    >;
  }
}
