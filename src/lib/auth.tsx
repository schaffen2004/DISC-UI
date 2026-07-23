import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { displayName, getMe, login as loginRequest, type UserProfile } from "@/lib/api/auth";
import { getStoredToken, setStoredToken } from "@/lib/api/client";
import { isStaffRole } from "@/lib/roles";

type AuthContextValue = {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  role: string | null;
  displayName: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const me = await getMe();
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const stored = getStoredToken();
      if (!stored) {
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
        }
        return;
      }
      setToken(stored);
      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch {
        setStoredToken(null);
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginRequest({ username, password });
    setStoredToken(result.token);
    setToken(result.token);
    const me = await getMe();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      isAuthenticated: Boolean(token),
      isStaff: isStaffRole(user?.role),
      role: user?.role ?? null,
      displayName: displayName(user),
      login,
      logout,
      refreshUser,
    }),
    [token, user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      token: null,
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isStaff: false,
      role: null,
      displayName: "User",
      login: async () => {},
      logout: () => {},
      refreshUser: async () => {},
    } satisfies AuthContextValue;
  }
  return ctx;
}
