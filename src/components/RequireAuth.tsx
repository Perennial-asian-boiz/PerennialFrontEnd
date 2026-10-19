import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthApiError, cacheUser, clearSession, getCachedUser, getMe, getSessionToken, isAuthApiConfigured, type User } from "../api/auth";
import { AuthUserContext } from "./authUserContext";

let verifiedSession: { token: string; user: User } | null = null;
let verificationInFlight: { token: string; promise: Promise<User> } | null = null;

function verifySession(token: string) {
  if (verifiedSession?.token === token) return Promise.resolve(verifiedSession.user);
  if (verificationInFlight?.token === token) return verificationInFlight.promise;

  const promise = getMe(token).then((user) => {
    verifiedSession = { token, user };
    cacheUser(user);
    return user;
  }).finally(() => {
    if (verificationInFlight?.promise === promise) verificationInFlight = null;
  });
  verificationInFlight = { token, promise };
  return promise;
}

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "authenticated" | "unauthenticated" | "unavailable">(() => {
    const token = getSessionToken();
    if (!isAuthApiConfigured() || !token) return "unauthenticated";
    return verifiedSession?.token === token || getCachedUser() !== null ? "authenticated" : "checking";
  });
  const [user, setUser] = useState<User | null>(() => {
    const token = getSessionToken();
    if (!token) return null;
    return verifiedSession?.token === token ? verifiedSession.user : getCachedUser();
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const token = getSessionToken();
    if (!isAuthApiConfigured() || !token) {
      return () => { active = false; };
    }

    if (verifiedSession?.token === token) return () => { active = false; };

    verifySession(token).then((account) => {
      if (active) {
        setUser(account);
        setStatus("authenticated");
      }
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof AuthApiError && error.status === 401) {
        if (verifiedSession?.token === token) verifiedSession = null;
        setUser(null);
        clearSession();
        setStatus("unauthenticated");
      } else if (!getCachedUser()) {
        setUser(null);
        setStatus("unavailable");
      }
    });

    return () => { active = false; };
  }, [attempt]);

  if (status === "checking") return <div className="auth-loading" role="status">Checking your session...</div>;
  if (status === "unavailable") return <div className="auth-loading" role="alert">Unable to check your session. <button type="button" onClick={() => { setStatus("checking"); setAttempt((value) => value + 1); }}>Try again</button></div>;
  if (status === "unauthenticated" || !getSessionToken()) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>;
}
