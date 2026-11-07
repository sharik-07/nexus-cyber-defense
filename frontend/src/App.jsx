import { useEffect, useState } from "react";
import { Cpu, FileText, LayoutDashboard, Menu, Network, Settings as Cog, ShieldAlert, ShieldCheck, Terminal as TermIcon, X } from "lucide-react";
import { api } from "./api";
import MatrixRain from "./components/MatrixRain";
import { usePoll } from "./hooks/usePoll";
import { useSettings } from "./settings";
import Alerts from "./pages/Alerts";
import Logs from "./pages/Logs";
import NetworkPage from "./pages/Network";
import Overview from "./pages/Overview";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import System from "./pages/System";
import TerminalPage from "./pages/Terminal";

const PAGES = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, Comp: Overview },
  { id: "system", label: "System", icon: Cpu, Comp: System },
  { id: "alerts", label: "Alerts", icon: ShieldAlert, Comp: Alerts },
  { id: "network", label: "Network", icon: Network, Comp: NetworkPage },
  { id: "terminal", label: "Terminal", icon: TermIcon, Comp: TerminalPage },
  { id: "logs", label: "Event logs", icon: FileText, Comp: Logs },
  { id: "reports", label: "Reports", icon: ShieldCheck, Comp: Reports },
  { id: "settings", label: "Settings", icon: Cog, Comp: SettingsPage },
];

function StatusPill() {
  const { settings } = useSettings();
  const { error } = usePoll(() => api("/health"), Math.max(settings.refresh, 3));
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${error ? "border-red-500/50 text-red-300" : "border-neon/40 text-neon"}`}>
      <span className={`h-2 w-2 rounded-full ${error ? "bg-red-500" : "bg-neon"}`} />
      {error ? "Backend offline" : "Backend online"}
    </span>
  );
}

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="hidden text-xs text-slate-400 sm:inline">{t.toLocaleTimeString([], { hour12: false })}</span>;
}

export default function App() {
  const { settings } = useSettings();
  const [page, setPage] = useState(() => PAGES.find((p) => p.id === window.location.hash.slice(1))?.id ?? "overview");
  const [open, setOpen] = useState(false);
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const Active = PAGES.find((p) => p.id === page).Comp;

  useEffect(() => { document.documentElement.classList.toggle("no-anim", !settings.animations); }, [settings.animations]);
  const go = (id) => { setPage(id); window.location.hash = id; setOpen(false); };

  return (
    <div className="relative min-h-screen font-mono text-sm text-slate-200">
      {settings.matrix && !reduce && <MatrixRain />}
      <div className="relative z-10 flex min-h-screen">
        <aside className={`no-print fixed inset-y-0 left-0 z-30 w-60 shrink-0 border-r border-edge bg-void/95 p-4 transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold tracking-wide text-neon">NEXUS</div>
              <div className="text-xs text-cyan2">CYBER DEFENSE</div>
            </div>
            <button className="md:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button>
          </div>
          <nav className="space-y-1">
            {PAGES.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => go(id)} aria-current={page === id ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neon ${page === id ? "border-neon/40 bg-neon/10 text-neon" : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
          <p className="mt-8 text-xs leading-relaxed text-slate-500">Read-only monitoring of this computer. Everything shown is measured locally.</p>
        </aside>
        {open && <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setOpen(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print flex items-center justify-between gap-3 border-b border-edge bg-void/80 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <button className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
              <h1 className="text-base font-semibold text-slate-100">{PAGES.find((p) => p.id === page).label}</h1>
            </div>
            <div className="flex items-center gap-3"><Clock /><StatusPill /></div>
          </header>
          <main className="flex-1 p-4 md:p-6"><Active /></main>
          <footer className="no-print border-t border-edge px-4 py-2 text-xs text-slate-500">NEXUS CYBER DEFENSE · local only (127.0.0.1) · read-only</footer>
        </div>
      </div>
    </div>
  );
}