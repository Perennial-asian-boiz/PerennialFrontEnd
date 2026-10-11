import { BrowserRouter, Route, Routes } from "react-router-dom";
import Company from "./pages/Company";
import Confirmation from "./pages/Confirmation";
import AccountCreated from "./pages/AccountCreated";
import AccessGranted from "./pages/AccessGranted";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import Insights from "./pages/Insights";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import PasswordEmailSent from "./pages/PasswordEmailSent";
import Settings from "./pages/Settings";
import Setup from "./pages/Setup";
import Signup from "./pages/Signup";
import Watchlist from "./pages/Watchlist";
import VerifyCode from "./pages/VerifyCode";
import Welcome from "./pages/Welcome";
import WhyCompany from "./pages/WhyCompany";
import { WatchlistProvider } from "./components/watchlistStore";

function App() {
  return (
    <BrowserRouter>
      <WatchlistProvider><Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot-password/sent" element={<PasswordEmailSent />} />
        <Route path="/verify-code" element={<VerifyCode />} />
        <Route path="/account-created" element={<AccountCreated />} />
        <Route path="/access-granted" element={<AccessGranted />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/confirmation" element={<Confirmation />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/company" element={<Company />} />
        <Route path="/why" element={<WhyCompany />} />
        <Route path="/settings" element={<Settings />} />
      </Routes></WatchlistProvider>
    </BrowserRouter>
  );
}

export default App;
