#!/usr/bin/env python3
"""Trigger the cockpit's Buffer sweep on loopback. Emit ids and outcomes only, never content or token."""
import json
import os
import sys
import urllib.request

try:
    request = urllib.request.Request(
        "http://127.0.0.1:3010/api/review-dashboard/buffer-sweep",
        data=b"{}",
        method="POST",
        headers={
            "Authorization": "Bearer " + os.environ["COCKPIT_BUFFER_SWEEP_TOKEN"],
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=280) as response:
        result = json.load(response)
    print(json.dumps(result))
    if result.get("ok") is not True:
        sys.exit(1)
    # A post that could not go is a failure of the unit, so journalctl shows it.
    bad = [p for r in result.get("rows", []) for p in r.get("posts", [])
           if p.get("outcome") in ("failed", "stuck", "missing", "concurrent")]
    if bad:
        sys.exit(2)
except Exception as error:
    print("Buffer sweep failed: " + type(error).__name__, file=sys.stderr)
    sys.exit(1)
