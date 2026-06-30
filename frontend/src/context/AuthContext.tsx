import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as authApi from "../api/auth";
import type { AuthUser } from "../api/auth";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  /** Apply user object returned from profile APIs without an extra /me round-trip */
  updateUser: (u: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  // Load current user from API when a token exists (session restore)
  useEffect(() => {
    if (token) {
      authApi
        .checkAuth()
        .then((res) => {
          if (res.success) {
            setUser(res.data.user);
          } else {
            localStorage.removeItem("token");
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const refreshUser = async () => {
    const res = await authApi.checkAuth();
    if (res.success && res.data?.user) {
      setUser(res.data.user);
    }
  };

  const updateUser = (u: AuthUser) => {
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    if (res.success) {
      localStorage.setItem("token", res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    }
    return { success: false, error: res.error || "Login failed" };
  };

  const signup = async (email: string, password: string, confirmPassword: string) => {
    const res = await authApi.signup(email, password, confirmPassword);
    if (res.success) {
      return { success: true };
    }
    return { success: false, error: res.error || "Signup failed" };
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn("Server-side logout failed; clearing local session.", err);
    }
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        signup,
        logout: handleLogout,
        refreshUser,
        updateUser,
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
