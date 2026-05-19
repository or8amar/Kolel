"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL = 25;
const STEP = 25;

interface LazyScrollListProps<T> {
  items: T[];
  emptyMessage?: string;
  className?: string;
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T, index: number) => string;
}

/** מציג רק חלק מהרשימה; טוען עוד כשגוללים למטה (מה שרואים + עוד קצת). */
export function LazyScrollList<T>({
  items,
  emptyMessage = "אין פריטים.",
  className = "",
  renderItem,
  getKey,
}: LazyScrollListProps<T>) {
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(INITIAL);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [items]);

  const loadMore = useCallback(() => {
    setVisibleCount((n) => Math.min(items.length, n + STEP));
  }, [items.length]);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || visibleCount >= items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root, rootMargin: "120px", threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, items.length, loadMore]);

  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  if (!items.length) {
    return <p className="p-4 text-center text-sm text-ink-light">{emptyMessage}</p>;
  }

  return (
    <div className={className}>
      <div ref={scrollRef} className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain">
        <ul className="divide-y">
          {visible.map((item, i) => (
            <li key={getKey(item, i)}>{renderItem(item, i)}</li>
          ))}
        </ul>
        <div ref={sentinelRef} className="h-4" aria-hidden />
      </div>
      {hasMore ? (
        <p className="border-t bg-cream px-3 py-2 text-center text-xs text-ink-light">
          מוצגים {visible.length} מתוך {items.length} — גלול למטה לטעון עוד
        </p>
      ) : (
        <p className="border-t bg-cream px-3 py-2 text-center text-xs text-ink-light">
          סה״כ {items.length} בשורות
        </p>
      )}
    </div>
  );
}
