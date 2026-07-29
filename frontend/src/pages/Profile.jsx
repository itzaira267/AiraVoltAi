import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmtMoney, fmtNum, fmtDate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";

const TABS = [
  ["profile", "Profile"],
  ["reports", "Saved Reports"],
  ["analyses", "Recent Analyses"],
  ["favourites", "Favourites"],
  ["settings", "Settings"],
];

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const { favourites, loadFavourites, loadDashboard, currency } = useData();
  const [tab, setTab] = useState("profile");
  const [reports, setReports] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [name, setName] = useState(user?.name || "");
  const [cur, setCur] = useState(user?.settings?.currency || "$");
  const [notif, setNotif] = useState(user?.settings?.notifications ?? true);
  const [verifyToken, setVerifyToken] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([api.get("/reports"), api.get("/analysis")]);
      setReports(r.data);
      setAnalyses(a.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async () => {
    setBusy(true);
    try {
      await api.put("/auth/profile", { name, currency: cur, notifications: notif });
      await refresh();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(errMsg(e, "Could not update profile"));
    } finally {
      setBusy(false);
    }
  };

  const requestVerification = async () => {
    try {
      const { data } = await api.post("/auth/resend-verification");
      if (data.already_verified) return toast.info("Email already verified");
      setVerifyToken(data.verification_token);
      toast.success("Verification code generated below");
    } catch (e) {
      toast.error(errMsg(e, "Could not issue a verification code"));
    }
  };

  const confirmVerification = async () => {
    try {
      await api.post("/auth/verify-email", { token: verifyToken.trim() });
      await refresh();
      setVerifyToken("");
      toast.success("Email verified");
    } catch (e) {
      toast.error(errMsg(e, "Invalid verification token"));
    }
  };

  const deleteReport = async (id) => {
    await api.delete(`/reports/${id}`);
    setReports((r) => r.filter((x) => x.report_id !== id));
    toast.success("Report deleted");
  };

  const deleteAnalysis = async (id) => {
    await api.delete(`/analysis/${id}`);
    setAnalyses((a) => a.filter((x) => x.analysis_id !== id));
    await loadDashboard();
    toast.success("Analysis deleted");
  };

  const initials = (user?.name || user?.email || "A").slice(0, 1).toUpperCase();

  return (
    <section className="view-section" data-testid="profile-page">
      <div className="glass-card" style={{ marginBottom: "1.75rem" }}>
        <div className="profile-header">
          {user?.picture ? (
            <img src={user.picture} alt={user.name} className="profile-avatar" />
          ) : (
            <div className="profile-avatar">{initials}</div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: "1.7rem" }} data-testid="profile-name">
              {user?.name || "AiraVolt user"}
            </h2>
            <p style={{ fontSize: "0.9rem" }} data-testid="profile-email">
              {user?.email}
            </p>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
              <span className="badge-pill">{user?.role === "admin" ? "Administrator" : "Member"}</span>
              <span className="badge-pill">{user?.provider === "google" ? "Google account" : "Email account"}</span>
              <span className="badge-pill" data-testid="profile-verified-badge">
                {user?.email_verified ? "Email verified" : "Email unverified"}
              </span>
              <span className="badge-pill">Joined {fmtDate(user?.created_at)}</span>
            </div>
          </div>
          <button
            className="btn btn-danger"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
            data-testid="profile-logout-btn"
          >
            <i className="fa-solid fa-arrow-right-from-bracket" /> Log out
          </button>
        </div>

        <div className="profile-tabs">
          {TABS.map(([k, label]) => (
            <button key={k} className={`profile-tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)} data-testid={`profile-tab-${k}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div data-testid="profile-tab-content-profile">
            <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[
                ["Audits run", analyses.length, "fa-atom"],
                ["Reports saved", reports.length, "fa-file-contract"],
                ["Favourite actions", favourites.length, "fa-star"],
              ].map(([label, val, icon]) => (
                <div className="glass-card db-card" key={label}>
                  <div className="db-card-header">
                    <span>{label}</span>
                    <i className={`fa-solid ${icon}`} style={{ color: "var(--color-electric-blue)" }} />
                  </div>
                  <div className="db-card-value">{val}</div>
                </div>
              ))}
            </div>

            {!user?.email_verified && (
              <div className="alert alert-info" style={{ marginTop: "1.5rem", flexDirection: "column", alignItems: "stretch" }} data-testid="verify-email-block">
                <div>
                  <i className="fa-solid fa-envelope-circle-check" /> Verify your email to secure your account. Email delivery
                  is not enabled on this deployment, so the code appears here.
                </div>
                <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={requestVerification} data-testid="request-verification-btn">
                    Generate code
                  </button>
                  {verifyToken && (
                    <>
                      <input type="text" value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} style={{ maxWidth: 320 }} data-testid="verification-token-input" />
                      <button className="btn btn-primary btn-sm" onClick={confirmVerification} data-testid="confirm-verification-btn">
                        Verify
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div data-testid="profile-tab-content-reports">
            {reports.length === 0 && <p>No reports saved yet. Generate one from the Report page.</p>}
            {reports.map((r) => (
              <div className="list-row" key={r.report_id} data-testid="profile-report-row">
                <div>
                  <h4>{r.reference}</h4>
                  <small>
                    {r.input.buildingType} · {fmtNum(r.input.monthlyUnits)} kWh · efficiency {r.metrics.efficiencyScore}/100 · {fmtDate(r.created_at)}
                  </small>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <Link to="/report" className="btn btn-secondary btn-sm">
                    Open
                  </Link>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteReport(r.report_id)} data-testid="delete-report-btn">
                    <i className="fa-regular fa-trash-can" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "analyses" && (
          <div data-testid="profile-tab-content-analyses">
            {analyses.length === 0 && <p>No analyses yet. Run your first audit from the Analysis page.</p>}
            {analyses.map((a) => (
              <div className="list-row" key={a.analysis_id} data-testid="profile-analysis-row">
                <div>
                  <h4>
                    {a.input.buildingType} · {a.input.city || "—"}
                  </h4>
                  <small>
                    {fmtNum(a.input.monthlyUnits)} kWh · waste {a.metrics.wastePercent}% · saving{" "}
                    {fmtMoney(a.metrics.monthlySavings, a.input.currency || currency)}/mo · {fmtDate(a.created_at)}
                  </small>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => deleteAnalysis(a.analysis_id)} data-testid="delete-analysis-btn">
                  <i className="fa-regular fa-trash-can" />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "favourites" && (
          <div data-testid="profile-tab-content-favourites">
            {favourites.length === 0 && <p>No favourites yet. Star recommendations to save them here.</p>}
            {favourites.map((f) => (
              <div className="list-row" key={f.favourite_id} data-testid="profile-favourite-row">
                <div style={{ maxWidth: 640 }}>
                  <h4>{f.title}</h4>
                  <small>{f.detail}</small>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <span className="rec-saving-value">{fmtMoney(f.monthlySaving, currency)}/mo</span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={async () => {
                      await api.post("/favourites", { title: f.title });
                      loadFavourites();
                    }}
                    data-testid="remove-favourite-btn"
                  >
                    <i className="fa-regular fa-trash-can" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "settings" && (
          <div data-testid="profile-tab-content-settings">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="pname">Display name</label>
                <input id="pname" type="text" value={name} onChange={(e) => setName(e.target.value)} data-testid="settings-name-input" />
              </div>
              <div className="form-group">
                <label htmlFor="pcur">Preferred currency</label>
                <select id="pcur" value={cur} onChange={(e) => setCur(e.target.value)} data-testid="settings-currency-select">
                  {["$", "₹", "€", "£", "AED", "A$"].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group full-width">
                <label>Notifications</label>
                <div className="toggle-row">
                  <span style={{ fontSize: "0.86rem", color: "var(--color-gray-400)" }}>
                    In-app alerts for analyses, reports and bill scans
                  </span>
                  <div className={`switch ${notif ? "on" : ""}`} onClick={() => setNotif((n) => !n)} data-testid="settings-notifications-toggle" />
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveSettings} disabled={busy} data-testid="settings-save-btn">
              <i className={`fa-solid ${busy ? "fa-spinner spin" : "fa-floppy-disk"}`} /> Save settings
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
