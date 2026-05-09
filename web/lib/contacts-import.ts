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
    throw new Error("Browser Contacts API לא נתמך בדפדפן זה.");
  }

  const contacts = await (navigator as Navigator & { contacts: ContactsManager }).contacts.select(["name", "email", "tel"], {
    multiple: true,
  });

  return contacts
    .map((item) => ({
      fullName: item.name?.[0]?.trim() ?? "",
      phones: item.tel?.filter(Boolean) ?? [],
      email: item.email?.[0],
      source: "browser_contacts" as const,
    }))
    .filter((c) => c.fullName.length > 0);
}

export function parseCsvContacts(content: string): ImportedContact[] {
  const rows = content.split(/\r?\n/).filter(Boolean);
  if (rows.length < 2) return [];
  const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIndex = headers.findIndex((h) => ["name", "full_name", "fullname", "full name"].includes(h));
  const emailIndex = headers.findIndex((h) => h === "email");
  const phoneIndex = headers.findIndex((h) => ["phone", "phones", "tel", "mobile"].includes(h));
  if (nameIndex < 0) return [];

  return rows
    .slice(1)
    .map((line) => line.split(",").map((cell) => cell.trim()))
    .map((columns) => ({
      fullName: columns[nameIndex] ?? "",
      email: emailIndex >= 0 ? columns[emailIndex] : undefined,
      phones: phoneIndex >= 0 && columns[phoneIndex] ? [columns[phoneIndex]] : [],
      source: "csv" as const,
    }))
    .filter((c) => c.fullName.length > 0);
}

export function parseVcfContacts(content: string): ImportedContact[] {
  const cards = content.split("END:VCARD").map((card) => card.trim()).filter(Boolean);
  return cards
    .map((card) => {
      const fullName = card.match(/FN:(.+)/i)?.[1]?.trim() ?? "";
      const email = card.match(/EMAIL[^:]*:(.+)/i)?.[1]?.trim();
      const phone = card.match(/TEL[^:]*:(.+)/i)?.[1]?.trim();
      return {
        fullName,
        email,
        phones: phone ? [phone] : [],
        source: "vcf" as const,
      };
    })
    .filter((c) => c.fullName.length > 0);
}

declare global {
  interface ContactsManager {
    select(
      properties: Array<"name" | "email" | "tel" | "address" | "icon">,
      options?: { multiple?: boolean },
    ): Promise<Array<{ name?: string[]; email?: string[]; tel?: string[] }>>;
  }
}
