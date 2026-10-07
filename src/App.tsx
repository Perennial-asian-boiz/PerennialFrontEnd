import { BrowserRouter, Route, Routes } from "react-router-dom";
import Company from "./pages/Company";
import Confirmation from "./pages/Confirmation";
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Setup from "./pages/Setup";
import Signup from "./pages/Signup";
import Watchlist from "./pages/Watchlist";
import WhyCompany from "./pages/WhyCompany";
import { WatchlistProvider } from "./components/watchlistStore";

function App() {
  return (
    <BrowserRouter>
      <WatchlistProvider><Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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
