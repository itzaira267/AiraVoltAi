import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AiraLoader } from "@/components/AiraAvatar";

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || user === null) return <AiraLoader label="Verifying your session" step="Authenticating…" />;
  if (user === false) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
};
