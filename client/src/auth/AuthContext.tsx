import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthResponse, LoginInput, PublicUser } from "@tickets/shared";
import { api } from "../api/client";

const STORAGE_KEY = "tickets.session";

interface Session {
  token: string;
  user: PublicUser;
}

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Reads the stored session defensively: storage is user-controlled input. */
function readSession(): Session | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Session).token === "string" &&
      typeof (parsed as Session).user?.username === "string"
    ) {
      return parsed as Session;
    }
  } catch {
    // corrupted value -> treat as logged out
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Only the session token is stored - never the password.
  const [session, setSession] = useState<Session | null>(readSession);

  const login = useCallback(async (input: LoginInput) => {
    const { token, user }: AuthResponse = await api.login(input);
    const next = { token, user };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    const token = session?.token;
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    if (token) await api.logout(token).catch(() => undefined);
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
