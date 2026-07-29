import { AiraAvatar } from "@/components/AiraAvatar";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export const googleLogin = () => {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export const GoogleButton = ({ label = "Continue with Google" }) => (
  <button type="button" className="google-btn" onClick={googleLogin} data-testid="google-auth-btn">
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.9 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.1h12.6c-.5 3-2.4 5.5-5.1 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z" />
      <path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.1-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.5 2.3-6.4 0-11.7-4.4-13.6-10.4l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
    </svg>
    {label}
  </button>
);

export const AuthVisual = ({ title, points }) => (
  <div className="auth-visual" style={{ textAlign: "center" }}>
    <AiraAvatar size={300} testId="auth-aira-avatar" />
    <h3 style={{ marginTop: "1.5rem", fontSize: "1.4rem" }}>{title}</h3>
    <ul style={{ listStyle: "none", marginTop: "1.25rem", display: "inline-flex", flexDirection: "column", gap: "0.6rem", textAlign: "left" }}>
      {points.map((p) => (
        <li key={p} style={{ fontSize: "0.88rem", color: "var(--color-gray-300)" }}>
          <i className="fa-solid fa-circle-check" style={{ color: "var(--color-emerald)", marginRight: "0.6rem" }} />
          {p}
        </li>
      ))}
    </ul>
  </div>
);
