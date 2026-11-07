import { ArrowDown, ArrowUp, Network as NetIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { Card, Gate, OriginTag, Stat, axis, fmtBytes, fmtRate, fmtTime, tip } from "../components/ui";
import { usePoll } from "../hooks/usePoll";
import { useSettings } from "../settings";

export default function NetworkPage() {
  const { settings } = useSettings();
  const poll = usePoll(() => api("/network"), settings.refresh);
  return (
    <Gate poll={poll}>
      {(d) => (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <OriginTag origin="real" /> Counters of this computer's own network adapters. No traffic is captured or scanned.
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Download now" icon={ArrowDown} tone="cyan" value={fmtRate(d.totals.rx_bps)} />
            <Stat label="Upload now" icon={ArrowUp} tone="blue" value={fmtRate(d.totals.tx_bps)} />
            <Stat label="Total received" value={fmtBytes(d.totals.bytes_recv)} sub={`${d.totals.packets_recv.toLocaleString()} packets`} />
            <Stat label="Total sent" value={fmtBytes(d.totals.bytes_sent)} sub={`${d.totals.errors} errors - ${d.totals.drops} drops`} />
          </div>
          <Card title="Throughput" icon={NetIcon}>
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={d.history}>
                  <CartesianGrid stroke="#13303a" strokeDasharray="3 3" />
                  <XAxis dataKey="t" tickFormatter={fmtTime} minTickGap={40} {...axis} />
                  <YAxis tickFormatter={fmtBytes} width={64} {...axis} />
                  <Tooltip {...tip} labelFormatter={fmtTime} formatter={(v) => fmtRate(v)} />
                  <Legend />
                  <Area type="monotone" dataKey="rx_bps" name="Download" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.12} isAnimationActive={settings.animations} />
                  <Area type="monotone" dataKey="tx_bps" name="Upload" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} isAnimationActive={settings.animations} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Interfaces" icon={NetIcon}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="text-slate-400">
                  <tr><th className="py-1 pr-3">Name</th><th className="pr-3">Status</th><th className="pr-3">Speed</th><th className="pr-3">Addresses</th><th className="pr-3">Down / Up now</th><th className="pr-3">Received / Sent</th><th>Err / Drop</th></tr>
                </thead>
                <tbody>
                  {d.interfaces.map((n) => (
                    <tr key={n.name} className="border-t border-edge/50 align-top">
                      <td className="py-2 pr-3 text-slate-100">{n.name}</td>
                      <td className={`pr-3 ${n.is_up ? "text-neon" : "text-slate-500"}`}>{n.is_up ? "Up" : "Down"}</td>
                      <td className="pr-3">{n.speed_mbps ? `${n.speed_mbps} Mbps` : "-"}</td>
                      <td className="max-w-[220px] break-all pr-3">{n.addresses.join(", ") || "-"}</td>
                      <td className="pr-3">{fmtRate(n.rx_bps)} / {fmtRate(n.tx_bps)}</td>
                      <td className="pr-3">{fmtBytes(n.bytes_recv)} / {fmtBytes(n.bytes_sent)}</td>
                      <td>{n.errors} / {n.drops}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </Gate>
  );
}