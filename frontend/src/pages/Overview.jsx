import { ArrowDown, ArrowUp, Clock, Cpu, HardDrive, MemoryStick, ShieldAlert } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { Card, Gate, OriginTag, Stat, axis, fmtBytes, fmtRate, fmtTime, fmtUptime, pct, tip } from "../components/ui";
import { usePoll } from "../hooks/usePoll";
import { useSettings } from "../settings";

export default function Overview() {
  const { settings } = useSettings();
  const poll = usePoll(() => api("/overview"), settings.refresh);
  const anim = settings.animations;
  return (
    <Gate poll={poll}>
      {(d) => {
        const s = d.latest || {};
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <OriginTag origin="real" /> Host <b className="text-cyan2">{d.hostname}</b> - live metrics measured locally with psutil
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Stat label="CPU" icon={Cpu} value={pct(s.cpu)} percent={s.cpu} />
              <Stat label="Memory" icon={MemoryStick} value={pct(s.ram)} percent={s.ram} tone="cyan" />
              <Stat label="Disk" icon={HardDrive} value={pct(s.disk)} percent={s.disk} tone="blue" />
              <Stat label="Uptime" icon={Clock} value={fmtUptime(d.uptime_seconds)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="Download" icon={ArrowDown} tone="cyan" value={fmtRate(s.rx_bps)} />
              <Stat label="Upload" icon={ArrowUp} tone="blue" value={fmtRate(s.tx_bps)} />
              <Stat label="Open alerts" icon={ShieldAlert} value={d.open_alerts} />
            </div>
            <Card title="CPU, memory and disk (last few minutes)" icon={Cpu}>
              <div className="h-60">
                <ResponsiveContainer>
                  <AreaChart data={d.history}>
                    <CartesianGrid stroke="#13303a" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={fmtTime} minTickGap={40} {...axis} />
                    <YAxis domain={[0, 100]} unit="%" width={44} {...axis} />
                    <Tooltip {...tip} labelFormatter={fmtTime} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Legend />
                    <Area type="monotone" dataKey="cpu" name="CPU" stroke="#39ff88" fill="#39ff88" fillOpacity={0.12} isAnimationActive={anim} />
                    <Area type="monotone" dataKey="ram" name="Memory" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.08} isAnimationActive={anim} />
                    <Area type="monotone" dataKey="disk" name="Disk" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} isAnimationActive={anim} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Network throughput" icon={ArrowDown}>
              <div className="h-52">
                <ResponsiveContainer>
                  <LineChart data={d.history}>
                    <CartesianGrid stroke="#13303a" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={fmtTime} minTickGap={40} {...axis} />
                    <YAxis tickFormatter={fmtBytes} width={64} {...axis} />
                    <Tooltip {...tip} labelFormatter={fmtTime} formatter={(v) => fmtRate(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="rx_bps" name="Download" stroke="#22d3ee" dot={false} isAnimationActive={anim} />
                    <Line type="monotone" dataKey="tx_bps" name="Upload" stroke="#3b82f6" dot={false} isAnimationActive={anim} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        );
      }}
    </Gate>
  );
}