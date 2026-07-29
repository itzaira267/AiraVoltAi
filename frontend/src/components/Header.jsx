import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { NotificationCenter } from "@/components/NotificationCenter";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/meet-aira", label: "Meet Aira" },
  { to: "/analysis", label: "Analysis" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/report", label: "Report" },
  { to: "/simulator", label: "Simulator" },
  { to: "/chat", label: "Chat" },
  { to: "/contact", label: "Contact" },
];

export const Header = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const doLogout = async () => {
    await logout();
    setOpen(false);
    navigate("/");
  };

  const initials = (user?.name || user?.email || "A").trim().slice(0, 1).toUpperCase();

  return (
    <header className="app-header" data-testid="app-header">
      <div className="nav-container">
        <Link to="/" className="logo" data-testid="logo-link" onClick={() => setOpen(false)}>
          <i className="fa-solid fa-bolt-lightning logo-icon" />
          <span className="logo-text">AiraVolt AI</span>
        </Link>

        <nav>
          <ul className="nav-links">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.to === "/"} data-testid={`nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="nav-actions">
          {user && user.user_id ? (
            <>
              <NotificationCenter />
              <Link to="/profile" className="user-chip" data-testid="profile-chip">
                {user.picture ? <img src={user.picture} alt={user.name} /> : <span className="initials">{initials}</span>}
                <span>{user.name || user.email}</span>
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={doLogout} data-testid="logout-btn">
                <i className="fa-solid fa-arrow-right-from-bracket" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm" data-testid="header-login-btn">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm" data-testid="header-signup-btn">
                Get Started
              </Link>
            </>
          )}
          <button className="mobile-menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu" data-testid="mobile-menu-btn">
            <i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-drawer" data-testid="mobile-drawer">
          <ul>
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.to === "/"} onClick={() => setOpen(false)}>
                  {l.label}
                </NavLink>
              </li>
            ))}
            {user && user.user_id && (
              <li>
                <NavLink to="/profile" onClick={() => setOpen(false)}>
                  Profile
                </NavLink>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
};
