import { useState } from "react";
import { CheckCheck, Check, Search } from "lucide-react";
import { api } from "../api";
import { Badge, Card, ErrorBox, Gate, SEVERITIES } from "../components/ui";
import { usePoll } from "../hooks/usePoll";
import { useSettings } from "../settings";

export default function Alerts() {
  const { settings } = useSettings();
  const [f, setF] = useState({ severity: "all", status: "all", q: "" });
  const [err, setErr] = useState("");
  const qs = new URLSearchParams(f).toString();
  const poll = usePoll(() => api(`/alerts?${qs}`), settings.refresh, [qs]);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const ack = async (path) => {
    try { await api(path, { method: "POST" }); setErr(""); poll.reload(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={14} className="absolute left-2 top-2.5 text-slate-500" />
            <input className="input w-full pl-7" placeholder="Search alerts..." aria-label="Search alerts" value={f.q} onChange={set("q")} maxLength={100} />
          </div>
          <select className="input" aria-label="Severity" value={f.severity} onChange={set("severity")}>
            <option value="all">All severities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" aria-label="Status" value={f.status} onChange={set("status")}>
            <option value="all">All statuses</option><option value="open">Open</option><option value="acknowledged">Acknowledged</option>
          </select>
          <button className="btn" onClick={() => ack("/alerts/ack-all")}><CheckCheck size={14} /> Acknowledge all</button>
        </div>
      </Card>
      {err && <ErrorBox msg={err} />}
      <Gate poll={poll}>
        {(d) => (
          <Card title={`${d.total} alert${d.total === 1 ? "" : "s"}`} className="!p-0">
            <div className="-m-4">
              {d.items.length === 0 && <p className="p-6 text-center text-slate-500">No alerts match these filters.</p>}
              {d.items.map((a) => (
                <div key={a.id} className={`flex flex-wrap items-start gap-3 border-b border-edge/60 px-4 py-3 ${a.acknowledged ? "opacity-50" : ""}`}>
                  <div className="flex gap-2"><Badge level={a.severity} /></div>
                  <div className="min-w-[200px] flex-1">
                    <div className="font-semibold text-slate-100">{a.title}</div>
                    <div className="text-xs text-slate-400">{a.message}</div>
                    <div className="mt-1 text-[11px] text-slate-500">#{a.id} - {new Date(a.ts).toLocaleString()}</div>
                  </div>
                  {a.acknowledged ? <span className="text-xs text-slate-500">Acknowledged</span> : (
                    <button className="btn" onClick={() => ack(`/alerts/${a.id}/ack`)}><Check size={14} /> Acknowledge</button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </Gate>
    </div>
  );
}