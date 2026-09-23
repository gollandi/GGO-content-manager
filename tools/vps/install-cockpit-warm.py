#!/usr/bin/env python3
"""Idempotent root provisioning; private data survives rsync and app restart."""
from pathlib import Path
import grp
import os
import pwd
import shutil
import subprocess

root = Path(__file__).resolve().parent
state = Path("/var/lib/ggo-cockpit")
state.mkdir(mode=0o700, exist_ok=True)
os.chown(state, pwd.getpwnam("jj").pw_uid, grp.getgrnam("jj").gr_gid)
os.chmod(state, 0o700)
# Give the timer only the existing read-only bearer, not Notion/publish credentials.
lines = Path("/etc/ggo-content-manager.env").read_text().splitlines()
token_lines = [line for line in lines if line.startswith("COCKPIT_SERVICE_TOKEN=")]
if len(token_lines) != 1 or not token_lines[0].partition("=")[2].strip().strip("\"'"):
    raise RuntimeError("A configured read-only cockpit service token is required")
secrets = Path("/etc/ggo-cockpit-warm.env")
fd = os.open(secrets, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as file:
    file.write(token_lines[0] + "\n")
os.chmod(secrets, 0o600)
conf = Path("/etc/systemd/system/ggo-content-manager.service.d")
conf.mkdir(exist_ok=True)
(conf / "snapshots.conf").write_text("[Service]\nEnvironment=COCKPIT_SNAPSHOT_DIR=/var/lib/ggo-cockpit\n")
for name in ("ggo-cockpit-warm.service", "ggo-cockpit-warm.timer"):
    shutil.copyfile(root / name, Path("/etc/systemd/system") / name)
subprocess.run(["systemctl", "daemon-reload"], check=True)
subprocess.run(["systemctl", "enable", "ggo-cockpit-warm.timer"], check=True)
