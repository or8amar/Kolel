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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">כניסת אדמין</h1>
        <p className="mb-4 text-sm text-slate-600">התחברות למערכת הניהול</p>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="אימייל"
            className={fieldInput}
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמה"
            className={fieldInput}
          />
          <button disabled={loading} className={btnPrimary}>
            {loading ? "מתחבר..." : "התחברות"}
          </button>
        </form>
        {error ? <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
      </div>
    </main>
  );
}
