import { Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import { api } from "../api";
import { Bar, Card, Gate, OriginTag, fmtBytes, pct } from "../components/ui";
import { usePoll } from "../hooks/usePoll";
import { useSettings } from "../settings";

const Row = ({ k, v }) => (
  <div className="flex justify-between gap-4 border-b border-edge/50 py-1.5">
    <span className="text-slate-400">{k}</span><span className="text-right text-slate-200">{v}</span>
  </div>
);

export default function System() {
  const { settings } = useSettings();
  const poll = usePoll(() => api("/system"), Math.max(settings.refresh, 3));
  return (
    <Gate poll={poll}>
      {(d) => (
        <div className="space-y-4">
          <Card title="Host" icon={Server} right={<OriginTag origin="real" />}>
            <div className="grid gap-x-8 md:grid-cols-2">
              <Row k="Hostname" v={d.hostname} />
              <Row k="Operating system" v={d.platform} />
              <Row k="Python" v={d.python} />
              <Row k="Last boot" v={new Date(d.boot_time).toLocaleString()} />
              <Row k="CPU cores" v={`${d.cpu.physical ?? "?"} physical / ${d.cpu.logical} logical`} />
              <Row k="CPU frequency" v={d.cpu.freq_mhz ? `${d.cpu.freq_mhz} MHz` : "not available"} />
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="CPU per core" icon={Cpu}>
              <div className="grid grid-cols-2 gap-3">
                {d.cpu.per_core.map((v, i) => (
                  <div key={i}>
                    <div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">Core {i}</span><span>{pct(v)}</span></div>
                    <Bar percent={v} />
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Memory" icon={MemoryStick}>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span>RAM {fmtBytes(d.memory.used)} / {fmtBytes(d.memory.total)}</span><span>{pct(d.memory.percent)}</span></div>
                  <Bar percent={d.memory.percent} tone="cyan" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs"><span>Page file {fmtBytes(d.swap.used)} / {fmtBytes(d.swap.total)}</span><span>{pct(d.swap.percent)}</span></div>
                  <Bar percent={d.swap.percent} tone="blue" />
                </div>
                <p className="text-xs text-slate-500">Available: {fmtBytes(d.memory.available)}</p>
              </div>
            </Card>
          </div>
          <Card title="Disks" icon={HardDrive}>
            <div className="space-y-3">
              {d.partitions.map((p) => (
                <div key={p.mountpoint}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{p.mountpoint} <span className="text-slate-500">({p.fstype})</span> - {fmtBytes(p.used)} / {fmtBytes(p.total)}</span>
                    <span>{pct(p.percent)}</span>
                  </div>
                  <Bar percent={p.percent} tone="blue" />
                </div>
              ))}
            </div>
          </Card>
          <Card title="Top processes by memory" icon={Cpu}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400"><tr><th className="py-1 pr-4">PID</th><th className="pr-4">Name</th><th>Memory</th></tr></thead>
                <tbody>
                  {d.processes.map((p) => (
                    <tr key={p.pid} className="border-t border-edge/50"><td className="py-1.5 pr-4 text-slate-400">{p.pid}</td><td className="pr-4">{p.name}</td><td>{p.memory_percent}%</td></tr>
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