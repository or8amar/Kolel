import Link from "next/link";

interface FabProps {
  href: string;
  label: string;
}

export function Fab({ href, label }: FabProps) {
  return (
    <Link href={href} className="ep-fab lg:hidden" aria-label={label} title={label}>
      +
    </Link>
  );
}
