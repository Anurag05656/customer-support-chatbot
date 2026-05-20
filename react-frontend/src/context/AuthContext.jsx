import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || "";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem("guest_mode") === "true");

  const authHeaders = useCallback(
    () =>
      token
        ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        : { "Content-Type": "application/json" },
    [token]
  );

  /* Fetch current user on mount if token exists */
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/auth/user`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("Invalid token");
        return r.json();
      })
      .then((data) => {
        setUser(data.user);
        setIsGuest(false);
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.errors?.email?.[0] || "Login failed");
    }
    localStorage.setItem("auth_token", data.token);
    localStorage.removeItem("guest_mode");
    setToken(data.token);
    setUser(data.user);
    setIsGuest(false);
    return data;
  };

  const register = async (name, email, password, passwordConfirmation) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const firstError =
        data.message ||
        Object.values(data.errors || {})?.[0]?.[0] ||
        "Registration failed";
      throw new Error(firstError);
    }
    localStorage.setItem("auth_token", data.token);
    localStorage.removeItem("guest_mode");
    setToken(data.token);
    setUser(data.user);
    setIsGuest(false);
    return data;
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: authHeaders(),
        });
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("guest_mode");
    setToken(null);
    setUser(null);
    setIsGuest(false);
  };

  const enterGuestMode = () => {
    localStorage.setItem("guest_mode", "true");
    setIsGuest(true);
  };

  const value = {
    user,
    token,
    loading,
    isGuest,
    isAuthenticated: !!user && !!token,
    authHeaders: authHeaders(),
    login,
    register,
    logout,
    enterGuestMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
