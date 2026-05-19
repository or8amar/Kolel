"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      setUserEmail(session.user.email ?? null);

      const { data: adminRows, error: adminError } = await supabase.from("app_admins").select("email").limit(1);
      if (adminError || !adminRows?.length) {
        if (mounted) {
          setDenied(true);
          setLoading(false);
        }
        return;
      }

      if (mounted) setLoading(false);
    };
    void verify();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return <p className="rounded-lg bg-cream p-4 text-ink-mid">טוען...</p>;
  }

  if (denied) {
    return (
      <main className="mx-auto max-w-lg p-4" dir="rtl">
        <div className="ep-card border-warning/40 bg-warning-pale text-sm text-ink">
          <p className="mb-2 font-semibold">אין הרשאת גישה לנתונים</p>
          <p className="mb-2">
            התחברת בהצלחה{userEmail ? ` (${userEmail})` : ""}, אבל האימייל לא רשום כמנהל במערכת.
          </p>
          <p>
            ב-Supabase: Table Editor → <strong>app_admins</strong> → Insert row → הזן את אותו אימייל בדיוק, ואז התחבר
            מחדש.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
