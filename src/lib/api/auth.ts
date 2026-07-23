import { apiFetch } from "./client";

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResult = {
  email: string;
  token: string;
  expiresIn: number | string;
  refreshToken: string;
  referralCredentials?: unknown;
};

export type UserProfile = {
  id: string;
  email: string;
  phoneNumber?: string | null;
  role?: string;
  status?: string;
  profile?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    avatar?: string | null;
    company?: string | null;
    businessName?: string | null;
  } | null;
};

export function login(payload: LoginPayload) {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: payload,
    auth: false,
  });
}

export function getMe() {
  return apiFetch<UserProfile>("/user/me");
}

export function displayName(user: UserProfile | null | undefined) {
  if (!user) return "User";
  const full = user.profile?.fullName?.trim();
  if (full) return full;
  const parts = [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  return user.email?.split("@")[0] || "User";
}
