import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      setUser(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const persist = (data) => {
    if (data.session_token) localStorage.setItem("av_token", data.session_token);
    setUser(data.user);
    return data;
  };

  const login = async (email, password) => persist((await api.post("/auth/login", { email, password })).data);
  const signup = async (name, email, password) => persist((await api.post("/auth/register", { name, email, password })).data);
  const exchangeGoogle = async (sessionId) => persist((await api.post("/auth/session", { session_id: sessionId })).data);

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("av_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh, exchangeGoogle, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
