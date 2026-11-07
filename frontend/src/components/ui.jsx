import { AlertTriangle, Loader2 } from "lucide-react";

export const fmtBytes = (n) => {
  if (n == null) return "-";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
};
export const fmtRate = (n) => `${fmtBytes(n)}/s`;
export const fmtUptime = (s = 0) => `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
export const pct = (n) => (n == null ? "-" : `${Number(n).toFixed(0)}%`);
export const fmtTime = (t) => new Date(t * 1000).toLocaleTimeString([], { hour12: false });

export const tip = {
  contentStyle: { background: "#0a1118", border: "1px solid #13303a", borderRadius: 8, color: "#e2e8f0", fontSize: 12 },
  labelStyle: { color: "#22d3ee" },
};
export const axis = { tick: { fill: "#94a3b8", fontSize: 11 }, stroke: "#1e293b" };

const SEV = {
  critical: "text-red-400 border-red-500/50 bg-red-500/10",
  high: "text-orange-400 border-orange-500/50 bg-orange-500/10",
  medium: "text-amber-300 border-amber-400/50 bg-amber-400/10",
  low: "text-cyan-300 border-cyan-400/50 bg-cyan-400/10",
  info: "text-blue-300 border-blue-400/50 bg-blue-400/10",
};
export const SEVERITIES = ["critical", "high", "medium", "low", "info"];

export function Badge({ level }) {
  return <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${SEV[level] ?? SEV.info}`}>{level}</span>;
}

export function OriginTag() {
  return (
    <span className="rounded border border-neon/40 bg-neon/10 px-1.5 py-0.5 text-[10px] font-bold text-neon"
      title="Measured on this computer">
      REAL
    </span>
  );
}

const TONE = { neon: ["text-neon", "bg-neon"], cyan: ["text-cyan2", "bg-cyan2"], blue: ["text-azure", "bg-azure"] };

export function Bar({ percent = 0, tone = "neon" }) {
  const color = percent >= 90 ? "bg-red-500" : TONE[tone][1];
  return (
    <div className="h-1.5 rounded bg-white/10" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

export function Card({ title, icon: Icon, right, className = "", children }) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 border-b border-edge px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-cyan2">
            {Icon && <Icon size={16} />} {title}
          </h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, icon: Icon, tone = "neon", percent }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between text-xs text-slate-400">
        {label} {Icon && <Icon size={16} className={TONE[tone][0]} />}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${TONE[tone][0]}`}>{value}</div>
      {percent != null && <div className="mt-2"><Bar percent={percent} tone={tone} /></div>}
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function ErrorBox({ msg }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {msg}
    </div>
  );
}

export function Gate({ poll, children }) {
  const { data, error } = poll;
  if (!data) {
    return error ? <ErrorBox msg={error} /> : (
      <div className="flex items-center gap-2 text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading...</div>
    );
  }
  return <>{error && <div className="mb-3"><ErrorBox msg={`${error} - showing last known data.`} /></div>}{children(data)}</>;
}