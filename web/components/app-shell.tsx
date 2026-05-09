"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const links = [
  { href: "/", label: "דשבורד" },
  { href: "/import", label: "ייבוא אנשי קשר" },
  { href: "/potentials", label: "פוטנציאלים" },
  { href: "/payments", label: "הזנת תשלום" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <h1 className="text-lg font-bold text-slate-900">Kolel Payments</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white transition hover:bg-slate-700"
          >
            התנתקות
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 p-4 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border bg-white p-3">
          <nav className="grid gap-2">
            {links.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    isActive ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section className="rounded-xl border bg-white p-4">{children}</section>
      </div>
    </div>
  );
}
