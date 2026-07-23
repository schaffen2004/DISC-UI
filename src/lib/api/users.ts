import { apiFetch } from "./client";

export type UserListItem = {
  id: string;
  email: string;
  phoneNumber?: string | null;
  role?: string | null;
  status?: number | string | null;
  createdDate?: string | null;
  lastLogin?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  company?: string | null;
};

export type UserListResult = {
  data: UserListItem[];
  total: number;
  page: number;
  limit: number;
};

export type ListUsersParams = {
  search?: string;
  page?: number;
  limit?: number;
};

export function listUsers(params: ListUsersParams = {}) {
  const q = new URLSearchParams();
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<UserListResult>(`/user/all${qs ? `?${qs}` : ""}`);
}

/** UserStatus enum from API: NEW=0, ACTIVE=1, LOCK=2 */
export function userStatusLabel(status: number | string | null | undefined) {
  const n = typeof status === "string" ? Number(status) : status;
  switch (n) {
    case 0:
      return "New";
    case 1:
      return "Active";
    case 2:
      return "Locked";
    default:
      return status == null || status === "" ? "—" : String(status);
  }
}

export function userDisplayName(user: UserListItem) {
  const full = user.fullName?.trim();
  if (full && full.toUpperCase() !== "NULL") return full;
  const parts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  return user.email?.split("@")[0] || "User";
}

export function userInitials(user: UserListItem) {
  const name = userDisplayName(user);
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}
