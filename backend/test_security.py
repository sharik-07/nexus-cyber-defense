import unittest

import security as s


def conn(**kw):
    base = {"pid": 10, "process": "x.exe", "proto": "TCP", "exe": "C:\\Program Files\\x.exe", "status": "ESTABLISHED",
            "local_ip": "192.168.1.5", "local_port": 50000, "remote_ip": "8.8.8.8", "remote_port": 443}
    base.update(kw)
    return base


class RuleTests(unittest.TestCase):
    def keys(self, conns, baseline=None):
        return [f[0] for f in s.evaluate(conns, baseline)]

    def test_normal_traffic_is_quiet(self):
        self.assertEqual(self.keys([conn()]), [])

    def test_rdp_open_to_all(self):
        c = conn(status="LISTEN", local_ip="0.0.0.0", local_port=3389, remote_ip="", remote_port=0)
        self.assertEqual(self.keys([c]), ["exposed:3389"])

    def test_rdp_on_localhost_only_is_fine(self):
        c = conn(status="LISTEN", local_ip="127.0.0.1", local_port=3389, remote_ip="", remote_port=0)
        self.assertEqual(self.keys([c]), [])

    def test_smb_listening_is_not_flagged(self):
        c = conn(status="LISTEN", local_ip="0.0.0.0", local_port=445, remote_ip="", remote_port=0)
        self.assertEqual(self.keys([c]), [])

    def test_bad_port_public_ip_high(self):
        f = s.evaluate([conn(remote_ip="8.8.4.4", remote_port=4444)])
        self.assertEqual((f[0][0], f[0][1]), ("badport:10:4444", "high"))

    def test_bad_port_private_ip_ignored(self):
        self.assertEqual(self.keys([conn(remote_ip="192.168.1.20", remote_port=4444)]), [])

    def test_temp_folder_process(self):
        c = conn(exe="C:\\Users\\a\\AppData\\Local\\Temp\\evil.exe")
        self.assertEqual(self.keys([c]), ["temp:10"])

    def test_new_listener_only_after_baseline(self):
        c = conn(status="LISTEN", local_ip="127.0.0.1", local_port=5173, process="node.exe", remote_ip="", remote_port=0)
        self.assertEqual(self.keys([c], None), [])
        self.assertEqual(self.keys([c], set()), ["newlisten:5173:node.exe"])
        self.assertEqual(self.keys([c], {(5173, "node.exe")}), [])

    def test_dynamic_ports_and_unknown_process_ignored(self):
        mk = lambda port, proc: conn(status="LISTEN", local_ip="127.0.0.1", local_port=port, process=proc,
                                     remote_ip="", remote_port=0)
        self.assertEqual(self.keys([mk(55085, "svchost.exe")], set()), [])
        self.assertEqual(self.keys([mk(8000, "?")], set()), [])

    def test_collect_normalises_odd_listen_states(self):
        import socket
        from collections import namedtuple
        from unittest import mock
        A = namedtuple("addr", "ip port")
        C = namedtuple("C", "pid laddr raddr status type")
        fake = [
            C(19076, A("127.0.0.1", 5173), (), "FIN_WAIT1", socket.SOCK_STREAM),   # Vite, odd label
            C(11220, A("0.0.0.0", 5353), (), "NONE", socket.SOCK_DGRAM),           # UDP, never LISTEN
            C(13436, A("127.0.0.1", 51661), A("127.0.0.1", 5000), "ESTABLISHED", socket.SOCK_STREAM),
        ]
        class P:
            def __init__(self, pid): self.pid = pid
            def name(self): return "node.exe" if self.pid == 19076 else "chrome.exe"
            def exe(self): return "C:\\app\\x.exe"
        with mock.patch.object(s.psutil, "net_connections", return_value=fake), mock.patch.object(s.psutil, "Process", P):
            rows = s.collect()
        self.assertEqual([r["status"] for r in rows], ["LISTEN", "NONE", "ESTABLISHED"])
        self.assertEqual([r["proto"] for r in rows], ["TCP", "UDP", "TCP"])
        self.assertEqual(self.keys(rows, set()), ["newlisten:5173:node.exe"])

    def test_collect_runs_on_this_machine(self):
        self.assertIsInstance(s.collect(), list)
        self.assertIsInstance(s.snapshot(), list)


if __name__ == "__main__":
    unittest.main()