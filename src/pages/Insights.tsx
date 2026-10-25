import AppShell from "../components/AppShell";

export default function Insights() {
  return (
    <AppShell title="Insights" subtitle="Company insights will appear here when the data is ready.">
      <div className="panel empty-state">
        <h2>No insights yet</h2>
        <p>Insights will appear when company and sector data is available.</p>
      </div>
    </AppShell>
  );
}
