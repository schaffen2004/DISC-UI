export const TOKEN_KEY = "nw:token";

export type ApiEnvelope<T> = {
  code: number;
  success: boolean;
  message: string;
  data: T;
  errorMessage?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
    "http://localhost:8001";
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  token?: string | null;
  auth?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, token, auth = true, headers, ...rest } = options;
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const authToken = token === undefined ? getStoredToken() : token;
  const reqHeaders = new Headers(headers);
  if (!reqHeaders.has("Content-Type") && body !== undefined) {
    reqHeaders.set("Content-Type", "application/json");
  }
  if (auth && authToken) {
    reqHeaders.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    ...rest,
    headers: reqHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401) {
    setStoredToken(null);
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new ApiError("Unauthorized", 401);
  }

  let payload: ApiEnvelope<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      throw new ApiError(text || response.statusText || "Invalid response", response.status);
    }
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message || response.statusText || "Request failed",
      response.status,
      payload?.code,
    );
  }

  if (payload && typeof payload.success === "boolean") {
    if (!payload.success) {
      throw new ApiError(payload.message || "Request failed", response.status, payload.code);
    }
    return payload.data;
  }

  return payload as unknown as T;
}
