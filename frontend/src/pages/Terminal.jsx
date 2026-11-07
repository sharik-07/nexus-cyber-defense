import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Card } from "../components/ui";

const CMDS = ["help", "status", "system-info", "network-status", "alerts", "clear"];
const BANNER = ["NEXUS CYBER DEFENSE terminal - built-in commands only.", "No shell is executed. Type 'help' to list commands."];

const tone = (l) =>
  l.k === "in" ? "text-cyan2" : l.k === "err" ? "text-red-400" : l.k === "sys" ? "text-slate-500"
  : "text-slate-200";

export default function TerminalPage() {
  const [lines, setLines] = useState(BANNER.map((t) => ({ k: "sys", t })));
  const [input, setInput] = useState("");
  const [hist, setHist] = useState([]);
  const [hi, setHi] = useState(-1);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [lines]);

  async function run(cmd) {
    const c = cmd.trim();
    if (!c || busy) return;
    setHist((h) => [c, ...h].slice(0, 50));
    setHi(-1);
    setInput("");
    setLines((l) => [...l, { k: "in", t: `> ${c}` }]);
    setBusy(true);
    try {
      const r = await api("/terminal", { method: "POST", body: { command: c } });
      if (r.clear) setLines([]);
      else setLines((l) => [...l, ...r.lines.map((t) => ({ k: "out", t }))]);
    } catch (e) {
      setLines((l) => [...l, { k: "err", t: e.message }]);
    } finally {
      setBusy(false);
    }
  }

  const onKey = (e) => {
    if (e.key === "Enter") run(input);
    else if (e.key === "ArrowUp" && hist.length) { const i = Math.min(hi + 1, hist.length - 1); setHi(i); setInput(hist[i]); e.preventDefault(); }
    else if (e.key === "ArrowDown") { const i = hi - 1; setHi(i); setInput(i >= 0 ? hist[i] : ""); e.preventDefault(); }
  };

  return (
    <div className="space-y-3">
      <Card title="Terminal simulator">
        <div ref={box} className="h-[420px] overflow-y-auto rounded-md border border-edge bg-black/60 p-3 text-[13px] leading-relaxed" aria-live="polite">
          {lines.map((l, i) => <div key={i} className={`whitespace-pre-wrap break-words ${tone(l)}`}>{l.t}</div>)}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-edge bg-black/60 px-3 py-2 focus-within:border-neon">
          <span className="text-neon">nexus$</span>
          <input className="w-full bg-transparent text-slate-100 outline-none" aria-label="Terminal command" value={input} maxLength={40}
            onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} autoFocus spellCheck={false} autoComplete="off" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CMDS.map((c) => <button key={c} className="btn" onClick={() => run(c)}>{c}</button>)}
        </div>
      </Card>
    </div>
  );
}