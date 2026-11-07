import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { api } from "../api";
import { Badge, Card, Gate } from "../components/ui";
import { usePoll } from "../hooks/usePoll";
import { useSettings } from "../settings";

export default function Logs() {
  const { settings } = useSettings();
  const [f, setF] = useState({ q: "", level: "all" });
  const [page, setPage] = useState(1);
  const base = new URLSearchParams(f).toString();
  const qs = `${base}&page=${page}&page_size=25`;
  const poll = usePoll(() => api(`/logs?${qs}`), settings.refresh, [qs]);
  const set = (k) => (e) => { setF((p) => ({ ...p, [k]: e.target.value })); setPage(1); };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={14} className="absolute left-2 top-2.5 text-slate-500" />
            <input className="input w-full pl-7" placeholder="Search logs..." aria-label="Search logs" value={f.q} onChange={set("q")} maxLength={100} />
          </div>
          <select className="input" aria-label="Level" value={f.level} onChange={set("level")}>
            <option value="all">All levels</option><option value="error">Error</option><option value="warning">Warning</option><option value="info">Info</option>
          </select>
          <a className="btn" href={`/api/logs/export.csv?${base}`} download><Download size={14} /> Export CSV</a>
        </div>
      </Card>
      <Gate poll={poll}>
        {(d) => (
          <Card title={`${d.total} event${d.total === 1 ? "" : "s"}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-slate-400"><tr><th className="py-1 pr-3">Time</th><th className="pr-3">Level</th><th className="pr-3">Component</th><th>Message</th></tr></thead>
                <tbody>
                  {d.items.map((l) => (
                    <tr key={l.id} className="border-t border-edge/50 align-top">
                      <td className="whitespace-nowrap py-1.5 pr-3 text-slate-400">{new Date(l.ts).toLocaleString()}</td>
                      <td className="pr-3"><Badge level={l.level === "error" ? "high" : l.level === "warning" ? "medium" : "info"} /></td>
                      <td className="pr-3">{l.component}</td>
                      
                      <td className="break-words">{l.message}</td>
                    </tr>
                  ))}
                  {d.items.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-500">No events match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>Page {d.page} of {d.pages}</span>
              <div className="flex gap-2">
                <button className="btn" disabled={d.page <= 1} onClick={() => setPage(d.page - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
                <button className="btn" disabled={d.page >= d.pages} onClick={() => setPage(d.page + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
              </div>
            </div>
          </Card>
        )}
      </Gate>
    </div>
  );
}