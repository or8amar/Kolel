"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Fab } from "@/components/fab";
import { supabase } from "@/lib/supabase/client";

const primaryLinks = [
  { href: "/", label: "דשבורד", short: "בית", icon: "⌂" },
  { href: "/potentials", label: "פוטנציאלים", short: "פוטנציאל", icon: "◆" },
  { href: "/contacts", label: "אנשי קשר", short: "אנשי קשר", icon: "👥" },
];

const moreLinks = [
  { href: "/import", label: "ייבוא אנשי קשר", icon: "📥" },
  { href: "/payments", label: "הזנת תשלום", icon: "💰" },
  { href: "/contacts/add", label: "הוספת איש קשר", icon: "＋" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/contacts") {
    return pathname === "/contacts" || (pathname.startsWith("/contacts/") && !pathname.startsWith("/contacts/add"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean) {
  if (active) return "bg-navy text-white";
  return "text-ink-mid hover:bg-navy-pale hover:text-navy";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const showFab = !pathname.startsWith("/contacts/add") && pathname !== "/login";

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
    <div className="mx-auto flex min-h-screen max-w-app flex-col bg-cream shadow-ep-lg lg:max-w-7xl" dir="rtl">
      <header className="sticky top-0 z-30 flex h-16 min-h-16 items-center justify-between gap-3 bg-navy px-4 shadow-ep-md">
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/import"
            className="flex h-10 w-10 items-center justify-center rounded-ep-sm text-lg text-white transition active:bg-white/15"
            aria-label="ייבוא"
            title="ייבוא"
          >
            💾
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="relative flex h-10 w-10 items-center justify-center rounded-ep-sm text-lg text-white transition active:bg-white/15"
            aria-label="התנתקות"
            title="התנתקות"
          >
            ⚙
          </button>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <h1 className="truncate text-[17px] font-bold text-white">כולל — תשלומים</h1>
          <p className="mt-0.5 text-xs text-gold-light">מעקב פוטנציאלים ותרומות</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[220px_1fr] lg:gap-4 lg:p-4">
        <aside className="hidden lg:block">
          <nav className="ep-card sticky top-20 grid gap-1 p-2">
            {primaryLinks.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-ep-sm px-3 py-2.5 text-sm font-medium transition ${navLinkClass(active)}`}
                >
                  {link.label}
                </Link>
              );
            })}
            {moreLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-ep-sm px-3 py-2.5 text-sm font-medium transition ${navLinkClass(
                  isActive(pathname, link.href),
                )}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:rounded-ep lg:border lg:border-line lg:bg-white lg:pb-4 lg:shadow-ep">
          {children}
        </main>
      </div>

      {showFab ? <Fab href="/contacts/add" label="הוספת איש קשר" /> : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(26,31,60,0.08)] lg:hidden"
        aria-label="ניווט ראשי"
      >
        <div className="mx-auto grid h-16 max-w-app grid-cols-4">
          {primaryLinks.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium ${
                  active ? "font-bold text-navy" : "text-ink-light"
                }`}
              >
                {active ? (
                  <span className="absolute inset-x-[20%] top-0 h-0.5 rounded-b bg-gold" aria-hidden />
                ) : null}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-base leading-none ${
                    active ? "bg-success-pale" : ""
                  }`}
                  aria-hidden
                >
                  {link.icon}
                </span>
                <span>{link.short}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium ${
              moreActive ? "font-bold text-navy" : "text-ink-light"
            }`}
          >
            {moreActive ? (
              <span className="absolute inset-x-[20%] top-0 h-0.5 rounded-b bg-gold" aria-hidden />
            ) : null}
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-base leading-none ${
                moreActive ? "bg-success-pale" : ""
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
            className="absolute inset-0 bg-[rgba(10,14,40,0.55)]"
            aria-label="סגירה"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-ep bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-ep-lg">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">עוד</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-ep-sm bg-cream text-ink-mid"
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
                  className={`flex min-h-12 items-center gap-3 rounded-ep-sm px-4 text-base font-medium ${navLinkClass(
                    isActive(pathname, link.href),
                  )}`}
                >
                  <span aria-hidden>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="min-h-12 rounded-ep-sm bg-navy px-4 text-base font-semibold text-white"
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