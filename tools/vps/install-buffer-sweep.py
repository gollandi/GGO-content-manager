#!/usr/bin/env python3
"""Idempotent root provisioning for the Buffer sweep timer.

The sweep bearer is generated here, on the server, the first time and never
leaves it: the cockpit reads it from /etc/ggo-content-manager.env and the
timer from /etc/ggo-buffer-sweep.env (both 0600). Re-running keeps the value.
"""
from pathlib import Path
import os
import secrets
import shutil
import subprocess

KEY = "COCKPIT_BUFFER_SWEEP_TOKEN"
root = Path(__file__).resolve().parent
app_env = Path("/etc/ggo-content-manager.env")
lines = app_env.read_text().splitlines()
existing = [line for line in lines if line.startswith(KEY + "=")]
if len(existing) > 1:
    raise RuntimeError(f"{KEY} is set more than once in {app_env}")
if existing and existing[0].partition("=")[2].strip().strip("\"'"):
    token_line = existing[0]
else:
    token_line = f"{KEY}={secrets.token_urlsafe(48)}"
    lines = [line for line in lines if not line.startswith(KEY + "=")] + [token_line]
    fd = os.open(app_env, os.O_WRONLY | os.O_TRUNC)
    with os.fdopen(fd, "w") as file:
        file.write("\n".join(lines) + "\n")
sweep_env = Path("/etc/ggo-buffer-sweep.env")
fd = os.open(sweep_env, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as file:
    file.write(token_line + "\n")
os.chmod(sweep_env, 0o600)
for name in ("ggo-buffer-sweep.service", "ggo-buffer-sweep.timer"):
    shutil.copyfile(root / name, Path("/etc/systemd/system") / name)
subprocess.run(["systemctl", "daemon-reload"], check=True)
subprocess.run(["systemctl", "enable", "ggo-buffer-sweep.timer"], check=True)
