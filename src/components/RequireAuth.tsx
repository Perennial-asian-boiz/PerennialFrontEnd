import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthApiError, clearSession, getMe, getSessionToken, isAuthApiConfigured } from "../api/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "authenticated" | "unauthenticated" | "unavailable">(() => isAuthApiConfigured() && Boolean(getSessionToken()) ? "checking" : "unauthenticated");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const token = getSessionToken();
    if (!isAuthApiConfigured() || !token) {
      return () => { active = false; };
    }

    getMe(token).then(() => {
      if (active) setStatus("authenticated");
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof AuthApiError && error.status === 401) {
        clearSession();
        setStatus("unauthenticated");
      } else setStatus("unavailable");
    });

    return () => { active = false; };
  }, [location.pathname, attempt]);

  if (status === "checking") return <div className="auth-loading" role="status">Checking your session...</div>;
  if (status === "unavailable") return <div className="auth-loading" role="alert">Unable to check your session. <button type="button" onClick={() => { setStatus("checking"); setAttempt((value) => value + 1); }}>Try again</button></div>;
  if (status === "unauthenticated" || !getSessionToken()) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
