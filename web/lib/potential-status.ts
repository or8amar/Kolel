import type { PotentialStatus } from "@/lib/types";

/** פוטנציאלים פעילים — מוצגים ברשימת /potentials כברירת מחדל */
export const ACTIVE_POTENTIAL_STATUSES = ["new", "potential", "high"] as const satisfies readonly PotentialStatus[];

/** סגורים — יוצאים מרשימת הפוטנציאלים, איש הקשר נשאר במאגר */
export const CLOSED_POTENTIAL_STATUSES = ["paid", "refused", "not_interested"] as const satisfies readonly PotentialStatus[];

export const ALL_POTENTIAL_STATUSES: PotentialStatus[] = [
  ...ACTIVE_POTENTIAL_STATUSES,
  ...CLOSED_POTENTIAL_STATUSES,
];

export type ActivePotentialStatus = (typeof ACTIVE_POTENTIAL_STATUSES)[number];
export type ClosedPotentialStatus = (typeof CLOSED_POTENTIAL_STATUSES)[number];

export function isActivePotentialStatus(status: PotentialStatus): boolean {
  return (ACTIVE_POTENTIAL_STATUSES as readonly PotentialStatus[]).includes(status);
}

export function isClosedPotentialStatus(status: PotentialStatus): boolean {
  return (CLOSED_POTENTIAL_STATUSES as readonly PotentialStatus[]).includes(status);
}
