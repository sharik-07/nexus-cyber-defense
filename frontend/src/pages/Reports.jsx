import { Printer, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Badge, Card, Gate, OriginTag, SEVERITIES, fmtRate, fmtUptime } from "../components/ui";
import { usePoll } from "../hooks/usePoll";

export default function Reports() {
  const health = usePoll(() => api("/reports/health"), 10);
  const sec = usePoll(() => api("/reports/security"), 10);
  const color = (n) => (n >= 85 ? "text-neon" : n >= 60 ? "text-amber-300" : "text-red-400");
  return (
    <div className="space-y-4">
      <div className="no-print flex justify-end"><button className="btn" onClick={() => window.print()}><Printer size={14} /> Print / save as PDF</button></div>
      <Gate poll={health}>
        {(h) => (
          <Card title="System health report" icon={ShieldCheck} right={<OriginTag origin="real" />}>
            <div className="flex flex-wrap items-center gap-6">
              <div><div className={`text-5xl font-bold ${color(h.score)}`}>{h.score}</div><div className="text-xs text-slate-400">health score - {h.status}</div></div>
              <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                <span>Avg CPU: <b>{h.averages.cpu}%</b></span><span>Peak CPU: <b>{h.peaks.cpu}%</b></span>
                <span>Avg memory: <b>{h.averages.ram}%</b></span><span>Peak memory: <b>{h.peaks.ram}%</b></span>
                <span>Disk used: <b>{h.disk_percent}%</b></span><span>Uptime: <b>{fmtUptime(h.uptime_seconds)}</b></span>
                <span>Avg down: <b>{fmtRate(h.averages.rx_bps)}</b></span><span>Avg up: <b>{fmtRate(h.averages.tx_bps)}</b></span>
                <span>Samples: <b>{h.samples}</b> ({h.window_seconds}s)</span>
              </div>
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-300">{h.recommendations.map((r) => <li key={r}>{r}</li>)}</ul>
            <p className="mt-3 text-[11px] text-slate-500">Generated {new Date(h.generated_at).toLocaleString()}</p>
          </Card>
        )}
      </Gate>
      <Gate poll={sec}>
        {(s) => (
          <Card title="Security event summary" icon={ShieldCheck}>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div>Total alerts <b className="block text-xl text-slate-100">{s.total}</b></div>
              <div>Open <b className="block text-xl text-amber-300">{s.open}</b></div>
              <div>Acknowledged <b className="block text-xl text-neon">{s.acknowledged}</b></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {SEVERITIES.map((v) => <span key={v} className="flex items-center gap-1.5"><Badge level={v} /> {s.by_severity[v]}</span>)}
            </div>
            <div className="mt-4 space-y-1.5">
              {s.recent.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 border-t border-edge/50 pt-1.5 text-xs">
                  <Badge level={a.severity} /><span>{a.title}</span>
                  <span className="ml-auto text-slate-500">{new Date(a.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </Gate>
    </div>
  );
}