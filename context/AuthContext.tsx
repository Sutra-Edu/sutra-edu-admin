"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import api, { SESSION_EVENT, USER_KEY, cacheUser, clearSession, getToken, setSession } from "@/lib/api";
import { hasAll } from "@/lib/permissions";
import type { AdminUser } from "@/lib/types";

interface AuthContextType {
  user: AdminUser | null;
  permissions: string[];
  isLoading: boolean;
  can: (...required: string[]) => boolean;
  login: (token: string, user: AdminUser) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: AdminUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The session lives in localStorage; components read it through this store so every tab and component stays in sync
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(SESSION_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SESSION_EVENT, onChange);
  };
};
const readSession = () => localStorage.getItem(USER_KEY);
// undefined on the server / during hydration = "not known yet"
const readServerSession = () => undefined;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readSession, readServerSession);
  const user = useMemo<AdminUser | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AdminUser;
    } catch {
      return null;
    }
  }, [raw]);
  const router = useRouter();
  const pathname = usePathname();
  // Revalidate with the backend once per tab; the 401 interceptor catches a revoked token on any later request
  const revalidated = useRef(false);

  const setUser = useCallback((u: AdminUser) => cacheUser(u), []);

  const refresh = useCallback(async () => {
    const res = await api.get<AdminUser>("/admin/me");
    cacheUser(res.data);
  }, []);

  useEffect(() => {
    if (raw === undefined) return; // still hydrating
    if (!getToken()) {
      if (!pathname.startsWith("/login")) router.replace("/login");
      return;
    }
    if (revalidated.current) return;
    revalidated.current = true;
    refresh().catch((err) => {
      // 401 is handled by the interceptor; a 403 means the account is no longer an admin
      if (err?.response?.status === 403) {
        clearSession();
        router.replace("/login");
      }
    });
  }, [raw, pathname, router, refresh]);

  const login = (token: string, u: AdminUser) => {
    revalidated.current = true;
    setSession(token, u);
  };

  const logout = async () => {
    try {
      await api.post("/admin/auth/logout");
    } catch {
      // Session may already be gone; sign out locally either way
    }
    revalidated.current = false;
    clearSession();
    router.replace("/login");
  };

  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  const can = useCallback((...required: string[]) => hasAll(permissions, required), [permissions]);
  const isLoading = raw === undefined || (!user && !!getToken());

  return (
    <AuthContext.Provider value={{ user, permissions, isLoading, can, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
