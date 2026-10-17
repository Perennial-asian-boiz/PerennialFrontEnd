import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clearSession, getMe, getSessionToken, isAuthApiConfigured } from "../api/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "authenticated" | "unauthenticated">(() => isAuthApiConfigured() && Boolean(getSessionToken()) ? "checking" : "unauthenticated");

  useEffect(() => {
    let active = true;
    const token = getSessionToken();
    if (!isAuthApiConfigured() || !token) {
      return () => { active = false; };
    }

    getMe(token).then(() => {
      if (active) setStatus("authenticated");
    }).catch(() => {
      if (!active) return;
      clearSession();
      setStatus("unauthenticated");
    });

    return () => { active = false; };
  }, [location.pathname]);

  if (status === "checking") return <div className="auth-loading" role="status">Checking your session...</div>;
  if (status === "unauthenticated") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
