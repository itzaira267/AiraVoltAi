import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AiraLoader } from "@/components/AiraAvatar";

export const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { exchangeGoogle } = useAuth();
  const done = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sessionId = new URLSearchParams(location.hash.replace(/^#/, "")).get("session_id");
    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      try {
        await exchangeGoogle(sessionId);
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true });
      } catch {
        setError("Google sign-in could not be completed. Please try again.");
        setTimeout(() => navigate("/login", { replace: true }), 1800);
      }
    })();
  }, [location.hash, exchangeGoogle, navigate]);

  if (error)
    return (
      <div className="main-content" data-testid="auth-callback-error">
        <div className="alert alert-error" style={{ maxWidth: 480, margin: "4rem auto" }}>
          <i className="fa-solid fa-circle-exclamation" /> {error}
        </div>
      </div>
    );
  return <AiraLoader label="Completing secure sign-in" step="Exchanging Google session…" />;
};
