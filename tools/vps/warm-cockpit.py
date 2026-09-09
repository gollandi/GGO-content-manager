#!/usr/bin/env python3
"""Read-only local warm-up. Emit operational metadata only, never content/token."""
import json
import os
import sys
import urllib.request

try:
    request = urllib.request.Request(
        "http://127.0.0.1:3010/api/review-dashboard/state?warm=1",
        headers={"Authorization": "Bearer " + os.environ["COCKPIT_SERVICE_TOKEN"]},
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        result = json.load(response)
    if result.get("ok") is not True or result.get("errors") != 0:
        raise RuntimeError("Snapshot warm-up incomplete")
    metadata = {key: result[key] for key in (
        "ok", "elapsedMs", "cancelloGeneratedAt", "houseGeneratedAt", "warnings", "errors"
    )}
    if isinstance(result.get("briefings"), dict):
        metadata["briefings"] = {key: result["briefings"].get(key) for key in ("ready", "unavailable")}
    print(json.dumps(metadata))
except Exception as error:
    # Some HTTP error bodies may contain upstream details: do not print them.
    print("Cockpit warm-up failed: " + type(error).__name__, file=sys.stderr)
    sys.exit(1)
