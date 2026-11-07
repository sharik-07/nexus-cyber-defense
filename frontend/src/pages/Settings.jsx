import { api } from "../api";
import { Card, Gate } from "../components/ui";
import { usePoll } from "../hooks/usePoll";
import { REFRESH_CHOICES, useSettings } from "../settings";

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-edge/50 py-3">
      <span><span className="block text-slate-100">{label}</span><span className="text-xs text-slate-500">{hint}</span></span>
      <input type="checkbox" className="h-4 w-4 accent-[#39ff88]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const status = usePoll(() => api("/status"), 5, []);

  return (
    <div className="space-y-4">
      <Card title="Preferences">
        <div className="flex items-center justify-between gap-4 border-b border-edge/50 py-3">
          <span><span className="block text-slate-100">Refresh interval</span><span className="text-xs text-slate-500">How often pages ask the backend for new data.</span></span>
          <select className="input" aria-label="Refresh interval" value={settings.refresh} onChange={(e) => update({ refresh: Number(e.target.value) })}>
            {REFRESH_CHOICES.map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </div>
        <Toggle label="Animations" hint="Chart and interface motion." checked={settings.animations} onChange={(v) => update({ animations: v })} />
        <Toggle label="Matrix background" hint="Optional falling-code effect. Off by default and skipped if your system prefers reduced motion." checked={settings.matrix} onChange={(v) => update({ matrix: v })} />
      </Card>
      <Card title="Application status">
        <Gate poll={status}>
          {(s) => (
            <div className="grid gap-x-8 text-xs md:grid-cols-2">
              {[["Version", s.version], ["Bind address", `${s.host}:${s.port}`], ["Localhost only", s.loopback_only ? "yes" : "NO - not recommended"],
                ["Read-only mode", s.read_only ? "yes" : "no"], ["Sampler", s.sampler_running ? `running (every ${s.sample_seconds}s)` : "stopped"],
                ["Backend uptime", `${s.backend_uptime_seconds}s`], ["Python", s.python], ["psutil", s.psutil]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-edge/50 py-1.5"><span className="text-slate-400">{k}</span><span>{v}</span></div>
              ))}
            </div>
          )}
        </Gate>
      </Card>
    </div>
  );
}
