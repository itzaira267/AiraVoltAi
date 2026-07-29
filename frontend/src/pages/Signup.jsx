import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { GoogleButton, AuthVisual } from "@/components/AuthShared";

export default function Signup() {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    setBusy(true);
    try {
      await signup(form.name.trim(), form.email.trim(), form.password);
      navigate("/analysis", { replace: true });
    } catch (e2) {
      setError(errMsg(e2, "Could not create your account"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view-section auth-shell" data-testid="signup-page">
      <div className="glass-card auth-card">
        <span className="hero-tagline">Get started free</span>
        <h2>Create your AiraVolt account</h2>
        <p>Unlock AI energy audits, live dashboards and Aira's recommendations.</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }} data-testid="signup-error">
            <i className="fa-solid fa-circle-exclamation" /> {error}
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="name">Full name</label>
            <input id="name" type="text" value={form.name} onChange={(e) => set("name", e.target.value)} minLength={2} required data-testid="signup-name-input" />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required data-testid="signup-email-input" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={6} required data-testid="signup-password-input" />
          </div>
          <div className="form-group">
            <label htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} required data-testid="signup-confirm-input" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy} data-testid="signup-submit-btn">
            <i className={`fa-solid ${busy ? "fa-spinner spin" : "fa-user-plus"}`} /> {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-divider">or</div>
        <GoogleButton label="Sign up with Google" />

        <p className="auth-alt">
          Already registered? <Link to="/login" data-testid="login-link">Log in</Link>
        </p>
      </div>

      <AuthVisual
        title="What you get instantly"
        points={["Full facility audit from a single bill", "Live efficiency, savings and carbon metrics", "What-if simulator with ROI and solar payback", "Saved reports, chat history and favourites"]}
      />
    </section>
  );
}
