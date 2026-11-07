"""NEXUS CYBER DEFENSE - network connection monitor.

Read-only: looks only at the network connections of THIS computer
(psutil.net_connections). It never scans other hosts and never captures
packets. Findings are simple rule-based heuristics (not antivirus), tagged
"real" because they are measured on this PC.
"""
import ipaddress
import socket
import threading
import time

import psutil

SCAN_SECONDS = 15
REALERT_SECONDS = 3600
ANY_ADDR = ("0.0.0.0", "::")
EPHEMERAL_START = 49152  # Windows temporary / dynamic ports: too noisy to report
EXPOSED_PORTS = {23: "Telnet", 3389: "Remote Desktop (RDP)", 5900: "VNC", 5985: "WinRM"}
BAD_REMOTE_PORTS = {
    4444: "default Metasploit / reverse-shell port",
    31337: "classic backdoor port",
    1337: "common backdoor / test-shell port",
    6667: "IRC (used by old botnets)",
}
TEMP_MARKERS = ("\\appdata\\local\\temp\\", "\\windows\\temp\\", "\\tmp\\")

_lock = threading.Lock()
_last_alert = {}
_baseline = None  # (port, process) pairs that were already listening


def _is_public(ip):
    try:
        a = ipaddress.ip_address(ip.split("%")[0])
    except ValueError:
        return False
    return not (a.is_private or a.is_loopback or a.is_link_local or a.is_multicast or a.is_unspecified)


def collect():
    """Current inet connections of this PC as a list of dicts (read-only)."""
    rows, procs = [], {}
    try:
        conns = psutil.net_connections(kind="inet")
    except (psutil.AccessDenied, OSError):
        return rows
    for c in conns:
        if c.pid not in procs:
            name, exe = "?", ""
            if c.pid:
                try:
                    p = psutil.Process(c.pid)
                    name, exe = p.name(), p.exe()
                except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
                    pass
            procs[c.pid] = (name, exe)
        name, exe = procs[c.pid]
        tcp = c.type == socket.SOCK_STREAM
        # Windows sometimes reports odd state words for listening sockets, so a TCP
        # socket with no remote address is treated as LISTEN whatever the word says.
        status = "LISTEN" if (tcp and not c.raddr) else c.status
        rows.append({
            "pid": c.pid, "process": name, "exe": exe, "proto": "TCP" if tcp else "UDP", "status": status,
            "local_ip": c.laddr.ip if c.laddr else "", "local_port": c.laddr.port if c.laddr else 0,
            "remote_ip": c.raddr.ip if c.raddr else "", "remote_port": c.raddr.port if c.raddr else 0,
        })
    return rows


def evaluate(conns, baseline=None):
    """Pure function: connection dicts in, findings out.

    Each finding is (key, severity, title, message). `baseline` is the set of
    (port, process) pairs already listening at start; None disables rule 4.
    Rule 4 skips dynamic ports (49152+) and unknown processes to avoid noise.
    """
    found = []
    for c in conns:
        who = f"{c['process']} (PID {c['pid']})"
        exe = (c["exe"] or "").lower().replace("/", "\\")
        listening = c["status"] == "LISTEN"
        lport, rport = c["local_port"], c["remote_port"]

        if listening and c["local_ip"] in ANY_ADDR and lport in EXPOSED_PORTS:
            found.append((f"exposed:{lport}", "medium", f"{EXPOSED_PORTS[lport]} port open to the network",
                          f"{who} listens on all interfaces, port {lport}. Close it if you do not need it."))

        if c["status"] == "ESTABLISHED" and rport in BAD_REMOTE_PORTS and _is_public(c["remote_ip"]):
            found.append((f"badport:{c['pid']}:{rport}", "high", f"Connection to suspicious port {rport}",
                          f"{who} is connected to {c['remote_ip']}:{rport} ({BAD_REMOTE_PORTS[rport]})."))

        if c["status"] in ("ESTABLISHED", "LISTEN") and any(m in exe for m in TEMP_MARKERS):
            found.append((f"temp:{c['pid']}", "medium", "Network activity from a temporary folder",
                          f"{who} uses the network but runs from a temp folder. Check that you trust it."))

        if (baseline is not None and listening and lport < EPHEMERAL_START and c["process"] != "?"
                and (lport, c["process"]) not in baseline):
            found.append((f"newlisten:{lport}:{c['process']}", "low", f"New listening port {lport}",
                          f"{who} started listening on port {lport} after the monitor started."))
    return found


def snapshot(limit=300):
    """Connections for the dashboard (the exe path is left out)."""
    rows = collect()
    rows.sort(key=lambda r: (r["status"] != "ESTABLISHED", r["process"].lower(), r["local_port"]))
    return [{k: v for k, v in r.items() if k != "exe"} for r in rows[:limit]]


def _loop(add_alert, add_log):
    global _baseline
    time.sleep(3)
    while True:
        try:
            conns = collect()
            listening = {(c["local_port"], c["process"]) for c in conns if c["status"] == "LISTEN"}
            now = time.time()
            for key, sev, title, msg in evaluate(conns, _baseline):
                with _lock:
                    if now - _last_alert.get(key, 0) < REALERT_SECONDS:
                        continue
                    _last_alert[key] = now
                add_alert(sev, title, msg)
            if _baseline is None:
                add_log("info", "security", f"Connection monitor started: {len(conns)} connections, "
                                            f"{len(listening)} listening ports in baseline")
                _baseline = set(listening)
            else:
                _baseline |= listening
        except Exception as exc:  # keep the monitor alive
            add_log("error", "security", f"Monitor error: {type(exc).__name__}")
        time.sleep(SCAN_SECONDS)


def start(add_alert, add_log):
    threading.Thread(target=_loop, args=(add_alert, add_log), daemon=True, name="nexus-security").start()