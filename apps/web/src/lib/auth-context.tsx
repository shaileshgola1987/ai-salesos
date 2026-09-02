"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { LoginResponseDto, OrganizationDto, UserDto } from "@ai-salesos/shared";
import { apiFetch, clearToken, getToken, setToken } from "./api";
import { disconnectWhatsAppSocket } from "./socket";

interface RegisterInput {
  organizationName: string;
  gstin?: string;
  ownerName: string;
  email: string;
  phone?: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  user: UserDto | null;
  organization: OrganizationDto | null;
  loading: boolean;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<LoginResponseDto>;
  completeTwoFactorLogin: (pendingToken: string, code: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [organization, setOrganization] = useState<OrganizationDto | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setOrganization(null);
      setLoading(false);
      return;
    }
    try {
      const [me, org] = await Promise.all([
        apiFetch<UserDto>("/users/me"),
        apiFetch<OrganizationDto>("/organizations/me"),
      ]);
      setUser(me);
      setOrganization(org);
    } catch {
      clearToken();
      setUser(null);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial session check on mount
    void loadCurrentUser();
  }, [loadCurrentUser]);

  const register = useCallback(
    async (input: RegisterInput) => {
      const { accessToken } = await apiFetch<{ accessToken: string }>(
        "/auth/register",
        { method: "POST", body: JSON.stringify(input) },
      );
      setToken(accessToken);
      await loadCurrentUser();
    },
    [loadCurrentUser],
  );

  // Two outcomes: a normal accessToken, or {requiresTwoFactor, pendingToken} when the user
  // has 2FA enabled — the caller (LoginPage) checks which one it got.
  const login = useCallback(
    async (input: LoginInput) => {
      const result = await apiFetch<LoginResponseDto>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if ("accessToken" in result) {
        setToken(result.accessToken);
        await loadCurrentUser();
      }
      return result;
    },
    [loadCurrentUser],
  );

  const completeTwoFactorLogin = useCallback(
    async (pendingToken: string, code: string) => {
      const { accessToken } = await apiFetch<{ accessToken: string }>(
        "/auth/2fa/verify-login",
        { method: "POST", body: JSON.stringify({ pendingToken, code }) },
      );
      setToken(accessToken);
      await loadCurrentUser();
    },
    [loadCurrentUser],
  );

  const logout = useCallback(() => {
    clearToken();
    disconnectWhatsAppSocket();
    setUser(null);
    setOrganization(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        loading,
        register,
        login,
        completeTwoFactorLogin,
        logout,
        refresh: loadCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
