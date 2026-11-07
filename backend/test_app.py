import unittest

import app as nexus


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.c = nexus.app.test_client()
        with nexus.lock:
            nexus.state["alerts"].clear()
            nexus.state["logs"].clear()

    def test_health(self):
        self.assertEqual(self.c.get("/api/health").status_code, 200)

    def test_foreign_host_blocked(self):
        self.assertEqual(self.c.get("/api/health", base_url="http://evil.example").status_code, 403)

    def test_post_requires_json(self):
        r = self.c.post("/api/terminal", data="help", content_type="text/plain")
        self.assertEqual(r.status_code, 415)

    def test_terminal_help_and_no_shell(self):
        lines = self.c.post("/api/terminal", json={"command": "help"}).get_json()["lines"]
        self.assertEqual(lines[0], "Commands:")
        self.assertFalse(any("demo" in l.lower() for l in lines))
        r = self.c.post("/api/terminal", json={"command": "dir && whoami"}).get_json()
        self.assertTrue(r["lines"][0].startswith("Unknown command"))
        r = self.c.post("/api/terminal", json={"command": "scan-demo"}).get_json()
        self.assertTrue(r["lines"][0].startswith("Unknown command"))

    def test_alert_filter_validation_and_ack(self):
        self.assertEqual(self.c.get("/api/alerts?severity=bogus").status_code, 400)
        self.assertEqual(self.c.get("/api/alerts?origin=real").status_code, 200)  # unknown params are ignored
        a = nexus.add_alert("low", "t", "m")
        self.assertNotIn("origin", a)
        self.assertEqual(self.c.post(f"/api/alerts/{a['id']}/ack", json={}).status_code, 200)
        self.assertEqual(self.c.post("/api/alerts/99999/ack", json={}).status_code, 404)
        self.assertEqual(self.c.get("/api/alerts?status=open").get_json()["total"], 0)

    def test_csv_injection_guard(self):
        nexus.add_log("info", "x", "=cmd|' /C calc'!A0")
        text = self.c.get("/api/logs/export.csv").get_data(as_text=True)
        self.assertIn("'=cmd", text)
        self.assertNotIn("origin", text.splitlines()[0])

    def test_no_demo_anywhere(self):
        nexus.add_alert("high", "real alert", "msg")
        self.assertEqual(self.c.get("/api/settings").status_code, 404)
        self.assertEqual(self.c.get("/api/overview").get_json()["open_alerts"], 1)
        rep = self.c.get("/api/reports/security").get_json()
        self.assertNotIn("by_origin", rep)
        self.assertNotIn("demo", self.c.get("/api/status").get_data(as_text=True).lower())

    def test_read_only_endpoints(self):
        for p in ("/api/overview", "/api/system", "/api/network", "/api/logs", "/api/reports/health", "/api/reports/security"):
            self.assertEqual(self.c.get(p).status_code, 200, p)


if __name__ == "__main__":
    unittest.main()