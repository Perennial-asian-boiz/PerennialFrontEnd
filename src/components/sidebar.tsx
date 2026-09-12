import { useNavigate } from "react-router-dom";

const ROUTES: Record<string, string> = {
  Home: "/",
  Watchlist: "/watchlist",
  Insight: "/insights",
  Settings: "/settings",
};

type SidebarProps = {
  navigations: Array<string>;
};

export default function Sidebar({ navigations }: SidebarProps) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-10 mt-10 w-[80%]">
      {navigations.map((n) => (
        <button
          className="border rounded-md h-15 cursor-pointer hover:bg-sky-700"
          key={n}
          onClick={() => navigate(ROUTES[n])}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
