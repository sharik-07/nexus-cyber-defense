"""Start NEXUS CYBER DEFENSE with the network connection monitor.

Use this instead of `python app.py`:   python run.py
"""
import sys

from flask import jsonify

import app as nexus
import security


@nexus.app.get("/api/connections")
def connections():
    return jsonify(items=security.snapshot(),
                   note="Connections of this computer only, measured locally with psutil.")


if __name__ == "__main__":
    if not nexus.LOOPBACK:
        print("WARNING: NEXUS_HOST is not loopback. This API has no authentication.", file=sys.stderr)
    nexus.start_sampler()
    security.start(nexus.add_alert, nexus.add_log)
    print(f"NEXUS CYBER DEFENSE backend: http://{nexus.HOST}:{nexus.PORT}")
    nexus.app.run(host=nexus.HOST, port=nexus.PORT, debug=False, threaded=True)