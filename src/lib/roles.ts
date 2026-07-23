/** Backend UserRole values used for staff-only UI. */
export const STAFF_ROLES = ["ADMIN", "OPERATOR"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toUpperCase();
}

export function isStaffRole(role?: string | null) {
  const r = normalizeRole(role);
  return (STAFF_ROLES as readonly string[]).includes(r);
}

export function isOperatorRole(role?: string | null) {
  return normalizeRole(role) === "OPERATOR";
}

export function isAdminRole(role?: string | null) {
  return normalizeRole(role) === "ADMIN";
}
