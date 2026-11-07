# NEXUS CYBER DEFENSE

[![tests](https://github.com/sharik-07/nexus-cyber-defense/actions/workflows/tests.yml/badge.svg)](https://github.com/sharik-07/nexus-cyber-defense/actions)

A read-only, SOC-style monitoring dashboard for your own Windows PC.
It shows live CPU, memory, disk and network data, raises alerts when
something looks wrong, and keeps an event log you can search and export.

Stack: Python (Flask, psutil) backend and a React (Vite, Tailwind, Recharts) frontend.

> Status: v1.1.0, early but working. Built and tested on Windows 11 Pro.
> The backend tests also run on Linux. The frontend has no automated tests yet.

## What it does

- Overview: CPU, memory, disk, uptime and network speed with live charts
- System: per-core CPU, memory, disks and the top processes by memory
- Alerts: severity filter, search, acknowledge one or all
- Network: adapters, speeds, counters and a throughput chart
- Connection monitor: flags suspicious network connections of THIS PC (see rules below)
- Terminal: a small list of built-in commands (no shell is ever executed)
- Event logs: search, pages and CSV export
- Reports: a simple health score and an alert summary you can print

## Detection rules

The monitor checks the network connections of the computer it runs on every 15 seconds:

1. Telnet, RDP, VNC or WinRM port open to the whole network (medium)
2. A program connected to a public IP on a known backdoor port: 4444, 31337, 1337 or 6667 (high)
3. A program that runs from a temp folder and uses the network (medium)
4. A program that starts listening on a new port after the monitor started (low)

There are also threshold alerts when CPU, memory or disk use reaches 90 percent.

These are simple heuristics. This is NOT an antivirus and it can raise false alarms
(for example installers that run from a temp folder). Review an alert before acting on it.

## What it does not do

- It never scans other computers, captures packets or runs shell commands.
- It has no login yet. Do not expose it to the internet. By default it listens on 127.0.0.1 only.
- Alerts and logs are kept in memory and are lost when the backend restarts.

## Quick start (Windows)

You need Python 3.10 or newer and Node.js LTS.

Backend (terminal 1):

    cd backend
    py -3 -m venv .venv
    .\.venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    python run.py

Frontend (terminal 2):

    cd frontend
    npm install
    npm run dev

Then open http://127.0.0.1:5173/

In VS Code, open the project folder and press Ctrl+Shift+B to start both
(see .vscode/tasks.json).

If PowerShell blocks the activate script, run this first:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned`

## Tests

    cd backend
    python -m unittest -v

## Project layout

    backend/
      app.py             Flask API, sampler, alerts, logs, terminal, reports
      security.py        network connection monitor (the rules above)
      run.py             starts the API together with the monitor (use this)
      test_app.py        API tests
      test_security.py   rule tests
    frontend/            React app (Vite, Tailwind, Recharts)
    .vscode/tasks.json   one-key start for both servers

## Roadmap

- Save alerts and logs in SQLite so they survive a restart
- Connections page in the dashboard
- Rules in a config file and a list of trusted programs to reduce false alarms
- Frontend build check in GitHub Actions
- Login, then monitoring of other PCs (only machines you own or have permission to monitor)

## License

MIT, see LICENSE.