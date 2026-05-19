"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { translateApiError } from "@/lib/labels";
import { supabase } from "@/lib/supabase/client";
import { btnPrimary, fieldInput } from "@/lib/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(translateApiError(authError.message));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-4" dir="rtl">
      <div className="w-full max-w-app ep-card">
        <h1 className="mb-1 text-2xl font-bold text-ink">כולל — תשלומים</h1>
        <p className="mb-5 text-sm text-ink-mid">התחברות למערכת הניהול</p>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-1.5 text-sm font-semibold text-ink-mid">
            אימייל
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={fieldInput}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-ink-mid">
            סיסמה
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={fieldInput}
            />
          </label>
          <button disabled={loading} className={btnPrimary}>
            {loading ? "מתחבר..." : "התחברות"}
          </button>
        </form>
        {error ? (
          <p className="mt-4 rounded-ep-sm border border-danger/30 bg-danger-pale p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
