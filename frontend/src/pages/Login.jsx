import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { GoogleButton, AuthVisual } from "@/components/AuthShared";

export default function Login() {
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && user.user_id) navigate(location.state?.from || "/dashboard", { replace: true });
  }, [user, navigate, location.state]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (e2) {
      setError(errMsg(e2, "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view-section auth-shell" data-testid="login-page">
      <div className="glass-card auth-card">
        <span className="hero-tagline">Welcome back</span>
        <h2>Log in to AiraVolt AI</h2>
        <p>Resume your audits, dashboards and consultations with Aira.</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }} data-testid="login-error">
            <i className="fa-solid fa-circle-exclamation" /> {error}
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email-input" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy} data-testid="login-submit-btn">
            <i className={`fa-solid ${busy ? "fa-spinner spin" : "fa-arrow-right-to-bracket"}`} /> {busy ? "Authenticating…" : "Log in"}
          </button>
        </form>

        <div style={{ textAlign: "right", marginTop: "0.75rem" }}>
          <Link to="/forgot-password" style={{ fontSize: "0.82rem", color: "var(--color-electric-blue)" }} data-testid="forgot-password-link">
            Forgot password?
          </Link>
        </div>

        <div className="auth-divider">or</div>
        <GoogleButton />

        <p className="auth-alt">
          New to AiraVolt? <Link to="/signup" data-testid="signup-link">Create an account</Link>
        </p>
      </div>

      <AuthVisual
        title="Aira is standing by"
        points={["Your audits and reports stay private to your account", "Gemini-powered analysis of 15 facility variables", "Voice-enabled energy consultations", "Investor-grade PDF reporting"]}
      />
    </section>
  );
}
