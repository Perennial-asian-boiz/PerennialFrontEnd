import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import Company from "./pages/Company";
import CompanySummary from "./pages/CompanySummary";
import Confirmation from "./pages/Confirmation";
import AccountCreated from "./pages/AccountCreated";
import AccessGranted from "./pages/AccessGranted";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import Insights from "./pages/Insights";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import PasswordReset from "./pages/PasswordReset";
import RecoveryPassword from "./pages/RecoveryPassword";
import Settings from "./pages/Settings";
import Setup from "./pages/Setup";
import Signup from "./pages/Signup";
import Watchlist from "./pages/Watchlist";
import VerifyCode from "./pages/VerifyCode";
import EmailConfirmation from "./pages/EmailConfirmation";
import Welcome from "./pages/Welcome";
import WhyCompany from "./pages/WhyCompany";
import { WatchlistProvider } from "./components/watchlistStore";
import RequireAuth from "./components/RequireAuth";

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

function LocalPreview({ children }: { children: ReactNode }) {
  return import.meta.env.DEV ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
      <WatchlistProvider><Routes>
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/dashboard-preview" element={<LocalPreview><Dashboard /></LocalPreview>} />
        <Route path="/setup-preview" element={<LocalPreview><Setup /></LocalPreview>} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/confirm" element={<EmailConfirmation />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<RecoveryPassword />} />
        <Route path="/verify-code" element={<VerifyCode />} />
        <Route path="/account-created" element={<AccountCreated />} />
        <Route path="/access-granted" element={<AccessGranted />} />
        <Route path="/welcome" element={<Protected><Welcome /></Protected>} />
        <Route path="/setup" element={<Protected><Setup /></Protected>} />
        <Route path="/confirmation" element={<Protected><Confirmation /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/settings/password" element={<Protected><PasswordReset /></Protected>} />
        <Route path="/insights" element={<Protected><Insights /></Protected>} />
        <Route path="/watchlist" element={<Protected><Watchlist /></Protected>} />
        <Route path="/company" element={<Protected><Company /></Protected>} />
        <Route path="/company/:symbol" element={<Protected><CompanySummary /></Protected>} />
        <Route path="/why" element={<Protected><WhyCompany /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></WatchlistProvider>
    </BrowserRouter>
  );
}

export default App;
