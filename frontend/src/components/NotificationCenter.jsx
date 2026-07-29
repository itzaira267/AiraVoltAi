import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useData } from "@/context/DataContext";

const ICONS = { success: "fa-circle-check", info: "fa-circle-info", warning: "fa-triangle-exclamation" };

export const NotificationCenter = () => {
  const { notifications, loadNotifications } = useData();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await api.post("/notifications/read", {});
    loadNotifications();
  };
  const clearAll = async () => {
    await api.delete("/notifications");
    loadNotifications();
  };

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        className="bell-btn"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) loadNotifications();
        }}
        aria-label="Notifications"
        data-testid="notification-bell-btn"
      >
        <i className="fa-regular fa-bell" />
        {notifications.unread > 0 && (
          <span className="bell-badge" data-testid="notification-unread-badge">
            {notifications.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" data-testid="notification-panel">
          <div className="notif-head">
            <strong>Notification Centre</strong>
            <span style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn-ghost btn btn-sm" onClick={markAll} data-testid="notification-mark-read-btn">
                Mark read
              </button>
              <button className="btn btn-sm btn-danger" onClick={clearAll} data-testid="notification-clear-btn">
                Clear
              </button>
            </span>
          </div>
          {notifications.items.length === 0 ? (
            <div className="notif-item" data-testid="notification-empty">
              <p>No notifications yet. Run an analysis to get started.</p>
            </div>
          ) : (
            notifications.items.map((n) => (
              <div key={n.notification_id} className={`notif-item ${n.read ? "" : "unread"}`} data-testid="notification-item">
                <i className={`fa-solid ${ICONS[n.kind] || ICONS.info}`} />
                <div>
                  <h5>{n.title}</h5>
                  <p>{n.message}</p>
                  <time>{new Date(n.created_at).toLocaleString()}</time>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
