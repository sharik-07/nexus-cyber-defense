"""NEXUS CYBER DEFENSE - read-only local monitoring backend (Flask + psutil).

Safety: binds to 127.0.0.1, rejects foreign Host headers, no shell execution,
no network scanning or traffic capture. Everything shown is measured on this PC.
"""
import csv
import io
import os
import platform
import re
import socket
import sys
import threading
import time
from collections import deque
from datetime import datetime

import psutil
from flask import Flask, Response, abort, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

VERSION = "1.1.0"
HOST = os.environ.get("NEXUS_HOST", "127.0.0.1")
try:
    PORT = int(os.environ.get("NEXUS_PORT", "5000"))
except ValueError:
    PORT = 5000
LOOPBACK = HOST in ("127.0.0.1", "localhost", "::1")
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
SAMPLE_SECONDS = 2
HISTORY_LEN = 90
MAX_ALERTS, MAX_LOGS = 300, 2000
SEVERITIES = ("critical", "high", "medium", "low", "info")
LEVELS = ("error", "warning", "info")
BOOT_TS = time.time()
DIST = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist"))

app = Flask(__name__, static_folder=None)
lock = threading.RLock()
state = {
    "history": deque(maxlen=HISTORY_LEN),
    "latest": {},
    "nic_rates": {},
    "alerts": [],
    "logs": [],
    "alert_seq": 1,
    "log_seq": 1,
    "cooldown": {},
    "sampler": False,
}

THRESHOLDS = [
    ("cpu", 90, "high", "High CPU usage"),
    ("ram", 90, "high", "High memory usage"),
    ("disk", 90, "medium", "Low free disk space"),
]


# ---------- helpers ----------
def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def fmt_bytes(n):
    n = float(n or 0)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def fmt_uptime(sec):
    sec = int(max(sec, 0))
    return f"{sec // 86400}d {sec % 86400 // 3600}h {sec % 3600 // 60}m"


def disk_root():
    return os.environ.get("SystemDrive", "C:") + "\\" if os.name == "nt" else "/"


def latest():
    with lock:
        return dict(state["latest"])


def add_log(level, component, message):
    with lock:
        state["logs"].append({"id": state["log_seq"], "ts": now_iso(), "level": level,
                              "component": component, "message": message})
        state["log_seq"] += 1
        if len(state["logs"]) > MAX_LOGS:
            del state["logs"][: MAX_LOGS // 10]


def add_alert(severity, title, message):
    with lock:
        alert = {"id": state["alert_seq"], "ts": now_iso(), "severity": severity, "title": title,
                 "message": message, "acknowledged": False}
        state["alert_seq"] += 1
        state["alerts"].append(alert)
        if len(state["alerts"]) > MAX_ALERTS:
            del state["alerts"][: MAX_ALERTS // 10]
    level = {"critical": "error", "high": "error", "medium": "warning"}.get(severity, "info")
    add_log(level, "alerts", title)
    return alert


def check_thresholds(s):
    for key, limit, sev, title in THRESHOLDS:
        if s[key] >= limit and s["t"] - state["cooldown"].get(key, 0) > 300:
            state["cooldown"][key] = s["t"]
            add_alert(sev, title, f"{key.upper()} at {s[key]:.0f}% (threshold {limit}%).")


# ---------- sampler (read-only psutil) ----------
def sampler():
    prev = None
    psutil.cpu_percent(None)
    time.sleep(0.5)
    while True:
        try:
            t = time.time()
            net, nic = psutil.net_io_counters(), psutil.net_io_counters(pernic=True)
            rx = tx = 0.0
            rates = {}
            if prev:
                dt = max(t - prev["t"], 0.001)
                rx = max(net.bytes_recv - prev["net"].bytes_recv, 0) / dt
                tx = max(net.bytes_sent - prev["net"].bytes_sent, 0) / dt
                for name, c in nic.items():
                    p = prev["nic"].get(name)
                    if p:
                        rates[name] = {"rx_bps": max(c.bytes_recv - p.bytes_recv, 0) / dt,
                                       "tx_bps": max(c.bytes_sent - p.bytes_sent, 0) / dt}
            sample = {"ts": now_iso(), "t": int(t), "cpu": psutil.cpu_percent(None),
                      "ram": psutil.virtual_memory().percent,
                      "disk": psutil.disk_usage(disk_root()).percent, "rx_bps": rx, "tx_bps": tx}
            with lock:
                state["latest"] = sample
                state["history"].append(sample)
                state["nic_rates"] = rates
            check_thresholds(sample)
            prev = {"t": t, "net": net, "nic": nic}
        except Exception as exc:  # keep the sampler alive
            add_log("error", "backend", f"Sampler error: {type(exc).__name__}")
        time.sleep(SAMPLE_SECONDS)


def start_sampler():
    with lock:
        if state["sampler"]:
            return
        state["sampler"] = True
    add_log("info", "backend", f"NEXUS backend {VERSION} started on {HOST}:{PORT}")
    threading.Thread(target=sampler, name="nexus-sampler", daemon=True).start()


# ---------- request guards ----------
def host_only(value):
    value = value or ""
    return value.split("]")[0] + "]" if value.startswith("[") else value.split(":")[0]


@app.before_request
def guard():
    if LOOPBACK and host_only(request.host).lower() not in ALLOWED_HOSTS:
        abort(403, "Forbidden host header")
    if request.method == "POST" and not request.is_json:
        abort(415, "Content-Type must be application/json")


@app.after_request
def security_headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    else:
        resp.headers["Content-Security-Policy"] = (
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'")
    return resp


@app.errorhandler(HTTPException)
def http_error(e):
    return jsonify(error=e.description or e.name), e.code


@app.errorhandler(Exception)
def unhandled(e):
    add_log("error", "backend", f"Unhandled error: {type(e).__name__}")
    return jsonify(error="Internal server error"), 500


def json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def pick(name, allowed):
    value = request.args.get(name, "all")
    if value != "all" and value not in allowed:
        abort(400, f"Invalid {name}")
    return value


def text_arg(name):
    return request.args.get(name, "").strip().lower()[:100]


def int_arg(name, default, lo, hi):
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        abort(400, f"Invalid {name}")
    return max(lo, min(hi, value))


# ---------- API ----------
@app.get("/api/health")
def health():
    return jsonify(ok=True)


@app.get("/api/status")
def status():
    return jsonify(version=VERSION, host=HOST, port=PORT, loopback_only=LOOPBACK,
                   sampler_running=state["sampler"], sample_seconds=SAMPLE_SECONDS,
                   backend_uptime_seconds=int(time.time() - BOOT_TS),
                   python=platform.python_version(), psutil=psutil.__version__, read_only=True)


@app.get("/api/overview")
def overview():
    with lock:
        hist = list(state["history"])
        open_alerts = sum(1 for a in state["alerts"] if not a["acknowledged"])
    return jsonify(hostname=socket.gethostname(), latest=latest(), history=hist, open_alerts=open_alerts,
                   uptime_seconds=int(time.time() - psutil.boot_time()))


@app.get("/api/system")
def system():
    vm, sw = psutil.virtual_memory(), psutil.swap_memory()
    try:
        freq = psutil.cpu_freq()
        freq_mhz = round(freq.current) if freq else None
    except Exception:
        freq_mhz = None
    parts = []
    for p in psutil.disk_partitions(all=False):
        if "cdrom" in p.opts or not p.fstype:
            continue
        try:
            u = psutil.disk_usage(p.mountpoint)
        except OSError:
            continue
        parts.append({"device": p.device, "mountpoint": p.mountpoint, "fstype": p.fstype,
                      "total": u.total, "used": u.used, "percent": u.percent})
    procs = []
    for p in psutil.process_iter(["pid", "name", "memory_percent"]):
        try:
            i = p.info
            procs.append({"pid": i["pid"], "name": i["name"] or "?", "memory_percent": round(i["memory_percent"] or 0, 2)})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    procs.sort(key=lambda x: x["memory_percent"], reverse=True)
    return jsonify(hostname=socket.gethostname(), platform=platform.platform(), python=platform.python_version(),
                   boot_time=datetime.fromtimestamp(psutil.boot_time()).astimezone().isoformat(timespec="seconds"),
                   cpu={"physical": psutil.cpu_count(logical=False), "logical": psutil.cpu_count(),
                        "freq_mhz": freq_mhz, "per_core": psutil.cpu_percent(interval=0.2, percpu=True)},
                   memory={"total": vm.total, "used": vm.used, "available": vm.available, "percent": vm.percent},
                   swap={"total": sw.total, "used": sw.used, "percent": sw.percent},
                   partitions=parts, processes=procs[:8])


@app.get("/api/network")
def network():
    stats, addrs, counters = psutil.net_if_stats(), psutil.net_if_addrs(), psutil.net_io_counters(pernic=True)
    with lock:
        rates = dict(state["nic_rates"])
        hist = [{"t": h["t"], "rx_bps": h["rx_bps"], "tx_bps": h["tx_bps"]} for h in state["history"]]
    ifaces = []
    for name, st in stats.items():
        c = counters.get(name)
        r = rates.get(name, {})
        ifaces.append({
            "name": name, "is_up": st.isup, "speed_mbps": st.speed, "mtu": st.mtu,
            "addresses": [a.address for a in addrs.get(name, []) if a.family in (socket.AF_INET, socket.AF_INET6)],
            "bytes_sent": c.bytes_sent if c else 0, "bytes_recv": c.bytes_recv if c else 0,
            "packets_sent": c.packets_sent if c else 0, "packets_recv": c.packets_recv if c else 0,
            "errors": (c.errin + c.errout) if c else 0, "drops": (c.dropin + c.dropout) if c else 0,
            "rx_bps": r.get("rx_bps", 0), "tx_bps": r.get("tx_bps", 0)})
    t = psutil.net_io_counters()
    s = latest()
    return jsonify(interfaces=ifaces, history=hist,
                   totals={"bytes_sent": t.bytes_sent, "bytes_recv": t.bytes_recv, "packets_sent": t.packets_sent,
                           "packets_recv": t.packets_recv, "errors": t.errin + t.errout, "drops": t.dropin + t.dropout,
                           "rx_bps": s.get("rx_bps", 0), "tx_bps": s.get("tx_bps", 0)})


@app.get("/api/alerts")
def list_alerts():
    sev = pick("severity", SEVERITIES)
    status_ = pick("status", ("open", "acknowledged"))
    q = text_arg("q")
    with lock:
        items = list(reversed(state["alerts"]))
    items = [a for a in items
             if (sev == "all" or a["severity"] == sev)
             and (status_ == "all" or a["acknowledged"] == (status_ == "acknowledged"))
             and (not q or q in a["title"].lower() or q in a["message"].lower())]
    return jsonify(items=items, total=len(items))


@app.post("/api/alerts/ack-all")
def ack_all():
    n = 0
    with lock:
        for a in state["alerts"]:
            if not a["acknowledged"]:
                a["acknowledged"] = True
                n += 1
    add_log("info", "user", f"Acknowledged {n} alerts")
    return jsonify(acknowledged=n)


@app.post("/api/alerts/<int:alert_id>/ack")
def ack(alert_id):
    with lock:
        found = next((a for a in state["alerts"] if a["id"] == alert_id), None)
        if found:
            found["acknowledged"] = True
    if not found:
        abort(404, "Alert not found")
    add_log("info", "user", f"Alert #{alert_id} acknowledged")
    return jsonify(found)


def filtered_logs():
    level, q = pick("level", LEVELS), text_arg("q")
    with lock:
        items = list(reversed(state["logs"]))
    return [l for l in items
            if (level == "all" or l["level"] == level)
            and (not q or q in l["message"].lower() or q in l["component"].lower())]


@app.get("/api/logs")
def logs():
    items = filtered_logs()
    size = int_arg("page_size", 25, 5, 100)
    pages = max(1, -(-len(items) // size))
    page = min(int_arg("page", 1, 1, 100000), pages)
    return jsonify(items=items[(page - 1) * size: page * size], total=len(items), page=page, pages=pages, page_size=size)


def csv_safe(value):
    s = str(value)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


@app.get("/api/logs/export.csv")
def export_logs():
    out = io.StringIO()
    w = csv.writer(out)
    keys = ("id", "ts", "level", "component", "message")
    w.writerow(keys)
    for l in filtered_logs():
        w.writerow([csv_safe(l[k]) for k in keys])
    return Response("\ufeff" + out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=nexus-event-logs.csv"})


# ---------- terminal (fixed allowlist, no shell) ----------
def t_help():
    return ["Commands:", "  help            list commands", "  status          live CPU / RAM / disk / network",
            "  system-info     host and hardware summary", "  network-status  interfaces and throughput",
            "  alerts          open alert summary", "  clear           clear the screen"]


def t_status():
    s = latest()
    return [f"CPU {s.get('cpu', 0):.0f}% | RAM {s.get('ram', 0):.0f}% | Disk {s.get('disk', 0):.0f}%",
            f"Network down {fmt_bytes(s.get('rx_bps'))}/s | up {fmt_bytes(s.get('tx_bps'))}/s",
            f"Uptime {fmt_uptime(time.time() - psutil.boot_time())}"]


def t_sysinfo():
    return [f"Host     : {socket.gethostname()}", f"OS       : {platform.platform()}",
            f"CPU cores: {psutil.cpu_count(logical=False)} physical / {psutil.cpu_count()} logical",
            f"RAM      : {fmt_bytes(psutil.virtual_memory().total)}", f"Python   : {platform.python_version()}"]


def t_network():
    up = [n for n, s in psutil.net_if_stats().items() if s.isup]
    t, s = psutil.net_io_counters(), latest()
    return [f"Interfaces up: {len(up)} ({', '.join(up[:5]) or 'none'})",
            f"Total received: {fmt_bytes(t.bytes_recv)} | sent: {fmt_bytes(t.bytes_sent)}",
            f"Now: down {fmt_bytes(s.get('rx_bps'))}/s | up {fmt_bytes(s.get('tx_bps'))}/s"]


def t_alerts():
    with lock:
        open_ = [a for a in state["alerts"] if not a["acknowledged"]]
    lines = [f"Open alerts: {len(open_)}"]
    lines += [f"  {a['severity']:<8} {a['title']}" for a in reversed(open_[-5:])]
    return lines


COMMANDS = {"help": t_help, "status": t_status, "system-info": t_sysinfo, "network-status": t_network,
            "alerts": t_alerts}


@app.post("/api/terminal")
def terminal():
    cmd = " ".join(str(json_body().get("command", "")).split()).lower()[:40]
    if cmd == "clear":
        return jsonify(lines=[], clear=True)
    fn = COMMANDS.get(cmd)
    if not fn:
        safe = re.sub(r"[^a-z0-9 _-]", "?", cmd)
        add_log("warning", "terminal", "Unknown terminal command rejected")
        return jsonify(lines=[f"Unknown command: {safe}", "Type 'help' for the list. No shell is executed."], clear=False)
    add_log("info", "terminal", f"Command run: {cmd}")
    return jsonify(lines=fn(), clear=False)


# ---------- reports ----------
@app.get("/api/reports/health")
def report_health():
    with lock:
        hist = list(state["history"])
    avg = lambda k: round(sum(h[k] for h in hist) / len(hist), 1) if hist else 0.0
    peak = lambda k: round(max((h[k] for h in hist), default=0), 1)
    cpu, ram, disk = avg("cpu"), avg("ram"), latest().get("disk", 0)
    score = int(max(0, min(100, round(100 - max(0, cpu - 60) * 0.6 - max(0, ram - 70) * 0.8 - max(0, disk - 80)))))
    recs = []
    if cpu >= 80:
        recs.append("Sustained high CPU: check Task Manager for busy processes.")
    if ram >= 85:
        recs.append("High memory use: close unused apps or add RAM.")
    if disk >= 85:
        recs.append("Disk is nearly full: free space or move large files.")
    return jsonify(generated_at=now_iso(), samples=len(hist), window_seconds=len(hist) * SAMPLE_SECONDS,
                   score=score, status="Healthy" if score >= 85 else "Needs attention" if score >= 60 else "Degraded",
                   averages={"cpu": cpu, "ram": ram, "rx_bps": avg("rx_bps"), "tx_bps": avg("tx_bps")},
                   peaks={"cpu": peak("cpu"), "ram": peak("ram")}, disk_percent=disk,
                   uptime_seconds=int(time.time() - psutil.boot_time()),
                   recommendations=recs or ["No action needed. Measured values are within normal ranges."])


@app.get("/api/reports/security")
def report_security():
    with lock:
        alerts = list(state["alerts"])
    return jsonify(generated_at=now_iso(), total=len(alerts),
                   open=sum(not a["acknowledged"] for a in alerts),
                   acknowledged=sum(a["acknowledged"] for a in alerts),
                   by_severity={s: sum(a["severity"] == s for a in alerts) for s in SEVERITIES},
                   recent=list(reversed(alerts))[:10])


# ---------- optional: serve built frontend (npm run build) ----------
@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def spa(path):
    if path.startswith("api/"):
        abort(404, "Unknown API route")
    if not os.path.isdir(DIST):
        return jsonify(message="API only. Run the frontend with 'npm run dev' or build it with 'npm run build'.")
    if path and os.path.isfile(os.path.join(DIST, path)):
        return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")


if __name__ == "__main__":
    if not LOOPBACK:
        print("WARNING: NEXUS_HOST is not loopback. This API has no authentication.", file=sys.stderr)
    start_sampler()
    print(f"NEXUS CYBER DEFENSE backend: http://{HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)