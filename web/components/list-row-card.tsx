import Link from "next/link";
import type { ReactNode } from "react";

interface ListRowCardProps {
  title: string;
  subtitle?: string | null;
  href: string;
  trailing?: ReactNode;
  meta?: ReactNode;
}

export function ListRowCard({ title, subtitle, href, trailing, meta }: ListRowCardProps) {
  return (
    <li className="list-row">
      <Link href={href} className="list-row-link">
        <div className="list-row-body">
          <p className="list-row-title">{title}</p>
          {subtitle ? <p className="list-row-sub">{subtitle}</p> : null}
          {meta ? <div className="list-row-meta">{meta}</div> : null}
        </div>
        {trailing ? <div className="list-row-trail">{trailing}</div> : null}
      </Link>
    </li>
  );
}
