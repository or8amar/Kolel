"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const primaryLinks = [
  { href: "/", label: "דשבורד", short: "בית" },
  { href: "/potentials", label: "פוטנציאלים", short: "פוטנציאל" },
  { href: "/contacts/add", label: "הוספה", short: "הוסף", accent: true },
  { href: "/contacts", label: "אנשי קשר", short: "אנשי קשר" },
];

const moreLinks = [
  { href: "/import", label: "ייבוא אנשי קשר" },
  { href: "/payments", label: "הזנת תשלום" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const moreActive = moreLinks.some((l) => isActive(pathname, l.href));

  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 md:px-4">
          <h1 className="text-base font-bold text-slate-900 md:text-lg">כולל — תשלומים</h1>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="hidden min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white transition hover:bg-slate-700 md:inline-flex"
          >
            התנתקות
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-0 md:gap-4 md:p-4 lg:grid-cols-[220px_1fr]">
        <aside className="hidden rounded-xl border bg-white p-3 lg:block">
          <nav className="grid gap-2">
            {[...primaryLinks.filter((l) => !l.accent), ...moreLinks].map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2.5 text-sm ${
                    active ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/contacts/add"
              className={`rounded-lg px-3 py-2.5 text-sm ${
                isActive(pathname, "/contacts/add")
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
              }`}
            >
              הוספת איש קשר
            </Link>
          </nav>
        </aside>

        <main className="min-w-0 px-3 py-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:rounded-xl md:border md:bg-white md:p-4 md:pb-4 lg:pb-4">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(15,23,42,0.08)] lg:hidden"
        aria-label="ניווט ראשי"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {primaryLinks.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[0.65rem] font-medium leading-tight ${
                  link.accent
                    ? active
                      ? "text-indigo-700"
                      : "text-indigo-600"
                    : active
                      ? "text-indigo-600"
                      : "text-slate-600"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                    link.accent
                      ? "bg-indigo-600 text-lg font-bold text-white"
                      : active
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                  aria-hidden
                >
                  {link.accent ? "+" : link.short.charAt(0)}
                </span>
                <span>{link.short}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[0.65rem] font-medium leading-tight ${
              moreActive ? "text-indigo-600" : "text-slate-600"
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${
                moreActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
              }`}
              aria-hidden
            >
              ⋯
            </span>
            <span>עוד</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="תפריט נוסף">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="סגירה"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">עוד</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="סגור"
              >
                ✕
              </button>
            </div>
            <nav className="grid gap-2">
              {moreLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex min-h-12 items-center rounded-xl px-4 py-3 text-base ${
                    isActive(pathname, link.href)
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="min-h-12 rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white"
              >
                התנתקות
              </button>
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
