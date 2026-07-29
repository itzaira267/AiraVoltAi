import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [notifications, setNotifications] = useState({ items: [], unread: 0 });
  const [favourites, setFavourites] = useState([]);

  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    try {
      const { data } = await api.get("/dashboard");
      setDashboard(data);
      return data;
    } catch {
      setDashboard({ hasData: false, latest: null, history: [], counts: {} });
      return null;
    } finally {
      setLoadingDash(false);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadFavourites = useCallback(async () => {
    try {
      const { data } = await api.get("/favourites");
      setFavourites(data);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavourite = async (rec) => {
    const { data } = await api.post("/favourites", rec);
    await loadFavourites();
    return data.favourited;
  };

  useEffect(() => {
    if (user && user.user_id) {
      loadDashboard();
      loadNotifications();
      loadFavourites();
    } else if (user === false) {
      setDashboard(null);
      setNotifications({ items: [], unread: 0 });
      setFavourites([]);
    }
  }, [user, loadDashboard, loadNotifications, loadFavourites]);

  const latest = dashboard?.latest || null;
  const currency = latest?.input?.currency || user?.settings?.currency || "$";

  return (
    <DataContext.Provider
      value={{
        dashboard,
        latest,
        currency,
        loadingDash,
        loadDashboard,
        notifications,
        loadNotifications,
        favourites,
        loadFavourites,
        toggleFavourite,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
