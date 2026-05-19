"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { buildFullName, parsePhoneInput } from "@/lib/contact-create";
import { buildPhoneIndex, findPhoneDuplicate, type ContactPhoneLookup } from "@/lib/duplicate-contacts";
import { translateApiError } from "@/lib/labels";
import { btnPrimary, fieldInput } from "@/lib/ui";
import { supabase } from "@/lib/supabase/client";

export default function AddContactPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [duplicateLink, setDuplicateLink] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setDuplicateLink(null);

    if (!firstName.trim()) {
      setError("שם פרטי הוא שדה חובה.");
      return;
    }
    const phones = parsePhoneInput(phone);
    if (!phones.length) {
      setError("טלפון הוא שדה חובה.");
      return;
    }

    setSaving(true);
    try {
      const { data: existing, error: loadError } = await supabase
        .from("contacts")
        .select("id, fullName, phones");
      if (loadError) throw new Error(loadError.message);

      const phoneIndex = buildPhoneIndex((existing as ContactPhoneLookup[]) ?? []);
      const duplicate = findPhoneDuplicate(phones, phoneIndex);
      if (duplicate) {
        setDuplicateLink({ id: duplicate.contactId, name: duplicate.fullName });
        setError(`מספר הטלפון כבר קיים במערכת (${duplicate.fullName}).`);
        return;
      }

      const fullName = buildFullName(firstName, lastName);
      const { data: inserted, error: insertError } = await supabase
        .from("contacts")
        .insert({
          fullName,
          phones,
          email: null,
          source: "manual",
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);

      const contactId = (inserted as { id: string }).id;
      const { error: potentialError } = await supabase.from("payment_potentials").insert({
        contactId,
        status: "new",
        notes: null,
        nextFollowUpAt: new Date().toISOString(),
      });
      if (potentialError) throw new Error(potentialError.message);

      router.push(`/potentials/${contactId}`);
      router.refresh();
    } catch (e) {
      setError(translateApiError((e as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell>
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">הוספת איש קשר</h2>
            <Link href="/contacts" className="text-sm text-navy hover:text-navy-light">
              חזרה לרשימה
            </Link>
          </div>

          <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4">
            <label className="grid gap-1 text-sm">
              <span>שם פרטי *</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={fieldInput}
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>שם משפחה</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={fieldInput}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>טלפון *</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                className={fieldInput}
                required
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className={btnPrimary}
            >
              {saving ? "שומר..." : "שמירה ויצירת פוטנציאל"}
            </button>
          </form>

          {error ? (
            <p className="rounded-lg bg-danger-pale p-2 text-sm text-danger">
              {error}{" "}
              {duplicateLink ? (
                <Link href={`/potentials/${duplicateLink.id}`} className="font-medium underline">
                  {duplicateLink.name}
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
