"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

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
      if (mounted) setLoading(false);
    };
    void verify();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return <p className="rounded-lg bg-slate-50 p-4 text-slate-600">טוען...</p>;
  }

  return <>{children}</>;
}
