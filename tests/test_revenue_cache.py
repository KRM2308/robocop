import tempfile
import time
import unittest

from src.revenue_sentinel import CacheConfig, RevenueCache, make_cache_key


class RevenueCacheTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        sqlite_path = f"{self.tmp.name}/cache.sqlite3"
        self.cache = RevenueCache(CacheConfig(ttl_seconds=1, l1_max_items=2, sqlite_path=sqlite_path))

    def tearDown(self):
        self.tmp.cleanup()

    def test_set_get_l1_hit(self):
        key = make_cache_key("stripe", "campaign-a", "1h")
        self.cache.set(key, {"amount": 12})
        value = self.cache.get(key)
        self.assertEqual(value["amount"], 12)
        self.assertEqual(self.cache.metrics()["l1_hits"], 1)

    def test_l2_hit_after_l1_eviction(self):
        self.cache.set("a", {"v": 1})
        self.cache.set("b", {"v": 2})
        self.cache.set("c", {"v": 3})
        value = self.cache.get("a")
        self.assertEqual(value["v"], 1)
        self.assertEqual(self.cache.metrics()["l2_hits"], 1)

    def test_get_or_set_provider_call_count(self):
        calls = {"n": 0}

        def provider():
            calls["n"] += 1
            return {"ok": True}

        self.cache.get_or_set("k", provider)
        self.cache.get_or_set("k", provider)

        self.assertEqual(calls["n"], 1)
        self.assertEqual(self.cache.metrics()["provider_calls"], 1)

    def test_stale_if_error(self):
        self.cache.set("err-k", {"value": 99}, ttl_seconds=0)

        def broken():
            raise RuntimeError("provider down")

        data = self.cache.get_or_set("err-k", broken)
        self.assertEqual(data["value"], 99)
        self.assertEqual(self.cache.metrics()["stale_served"], 1)

    def test_ttl_expiry(self):
        self.cache.set("ttl", {"x": 1}, ttl_seconds=1)
        time.sleep(1.05)
        self.assertIsNone(self.cache.get("ttl"))


if __name__ == "__main__":
    unittest.main()
