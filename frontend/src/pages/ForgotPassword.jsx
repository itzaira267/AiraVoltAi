import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { AuthVisual } from "@/components/AuthShared";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState("request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const request = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email: email.trim() });
      if (data.reset_token) setToken(data.reset_token);
      setStage("reset");
      toast.success("Reset token issued");
    } catch (e2) {
      setError(errMsg(e2, "Could not start password reset"));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token: token.trim(), password });
      toast.success("Password updated — please log in");
      navigate("/login", { replace: true });
    } catch (e2) {
      setError(errMsg(e2, "Could not reset your password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view-section auth-shell" data-testid="forgot-password-page">
      <div className="glass-card auth-card">
        <span className="hero-tagline">Account recovery</span>
        <h2>{stage === "request" ? "Reset your password" : "Set a new password"}</h2>
        <p>
          {stage === "request"
            ? "Enter your account email and we'll issue a secure reset token."
            : "Paste the reset token and choose a new password."}
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }} data-testid="forgot-error">
            <i className="fa-solid fa-circle-exclamation" /> {error}
          </div>
        )}

        {stage === "request" ? (
          <form className="auth-form" onSubmit={request}>
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="forgot-email-input" />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy} data-testid="forgot-submit-btn">
              <i className={`fa-solid ${busy ? "fa-spinner spin" : "fa-key"}`} /> {busy ? "Issuing token…" : "Send reset token"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={reset}>
            {token && (
              <div className="alert alert-info" data-testid="forgot-token-notice">
                <i className="fa-solid fa-circle-info" />
                <div>
                  Email delivery is not enabled on this deployment, so your reset token is shown below.
                  <div className="token-box" data-testid="reset-token-value">{token}</div>
                </div>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="token">Reset token</label>
              <input id="token" type="text" value={token} onChange={(e) => setToken(e.target.value)} required data-testid="reset-token-input" />
            </div>
            <div className="form-group">
              <label htmlFor="newpass">New password</label>
              <input id="newpass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required data-testid="reset-password-input" />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy} data-testid="reset-submit-btn">
              <i className={`fa-solid ${busy ? "fa-spinner spin" : "fa-lock"}`} /> {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        <p className="auth-alt">
          <Link to="/login" data-testid="back-to-login-link">Back to login</Link>
        </p>
      </div>

      <AuthVisual title="Security first" points={["Tokens expire after one hour", "Single-use reset links", "All sessions revoked after a reset", "bcrypt password hashing"]} />
    </section>
  );
}
