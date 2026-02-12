"""RevenueSentinel cache layer.

Multi-level cache design:
- L1: in-memory OrderedDict (LRU + TTL)
- L2: SQLite persistence for durability across restarts

Goal: reduce Stripe/PayPal API calls by serving hot keys from L1 and warm keys
from L2 before falling back to provider calls.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional


@dataclass(frozen=True)
class CacheConfig:
    """Runtime knobs for cache behavior."""

    ttl_seconds: int = 3600
    l1_max_items: int = 1024
    sqlite_path: str = "./data/revenue_cache.sqlite3"
    stale_if_error_seconds: int = 21600


class RevenueCache:
    """Two-level cache for RevenueSentinel payment/revenue payloads.

    Public methods are thread-safe for a single process thanks to an RLock.
    L2 persistence ensures no full cache loss on process restarts.
    """

    def __init__(self, config: Optional[CacheConfig] = None) -> None:
        self.config = config or CacheConfig()
        self._lock = threading.RLock()
        self._l1: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()

        # Observability counters.
        self._metrics: Dict[str, int] = {
            "l1_hits": 0,
            "l2_hits": 0,
            "misses": 0,
            "sets": 0,
            "provider_calls": 0,
            "invalidations": 0,
            "stale_served": 0,
            "errors": 0,
        }

        self._init_sqlite()

    def _init_sqlite(self) -> None:
        path = Path(self.config.sqlite_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cache_entries (
                    key TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL,
                    expires_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at)"
            )
            conn.commit()

    def _db(self) -> sqlite3.Connection:
        return sqlite3.connect(self.config.sqlite_path)

    def get(self, key: str) -> Optional[Any]:
        """Read from L1 first, then L2, respecting TTL."""
        now = time.time()

        with self._lock:
            if key in self._l1:
                expires_at, value = self._l1[key]
                if expires_at > now:
                    self._l1.move_to_end(key)
                    self._metrics["l1_hits"] += 1
                    return value
                # Expired in L1: remove and continue to L2.
                self._l1.pop(key, None)

            payload = self._get_from_l2(key)
            if payload is not None:
                expires_at, value = payload
                self._l1_set(key, expires_at, value)
                self._metrics["l2_hits"] += 1
                return value

            self._metrics["misses"] += 1
            return None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Write-through in L1 and L2 to keep persistence and speed."""
        ttl = ttl_seconds if ttl_seconds is not None else self.config.ttl_seconds
        expires_at = time.time() + ttl

        with self._lock:
            self._l1_set(key, expires_at, value)
            self._set_l2(key, expires_at, value)
            self._metrics["sets"] += 1

    def get_or_set(self, key: str, provider_fn: Callable[[], Any]) -> Any:
        """Return cached value or fetch provider and store.

        If provider call fails, serve a recently stale value from L2 when possible
        (`stale_if_error_seconds`) to maximize reliability.
        """
        cached = self.get(key)
        if cached is not None:
            return cached

        self._metrics["provider_calls"] += 1
        try:
            value = provider_fn()
        except Exception:
            self._metrics["errors"] += 1
            stale = self._get_stale_if_error(key)
            if stale is not None:
                self._metrics["stale_served"] += 1
                return stale
            raise

        self.set(key, value)
        return value

    def invalidate(self, key: str) -> None:
        """Remove a single cache entry from both levels."""
        with self._lock:
            self._l1.pop(key, None)
            with self._db() as conn:
                conn.execute("DELETE FROM cache_entries WHERE key = ?", (key,))
                conn.commit()
            self._metrics["invalidations"] += 1

    def invalidate_prefix(self, prefix: str) -> int:
        """Invalidate a campaign/provider namespace. Returns deleted count."""
        deleted = 0
        with self._lock:
            for key in list(self._l1.keys()):
                if key.startswith(prefix):
                    self._l1.pop(key, None)
                    deleted += 1

            with self._db() as conn:
                cur = conn.execute("DELETE FROM cache_entries WHERE key LIKE ?", (f"{prefix}%",))
                deleted += cur.rowcount if cur.rowcount > 0 else 0
                conn.commit()

            self._metrics["invalidations"] += deleted
        return deleted

    def purge_expired(self) -> int:
        """Periodic cleanup for L1 and L2 expired entries."""
        now = time.time()
        removed = 0
        with self._lock:
            for key, (expires_at, _value) in list(self._l1.items()):
                if expires_at <= now:
                    self._l1.pop(key, None)
                    removed += 1

            with self._db() as conn:
                cur = conn.execute("DELETE FROM cache_entries WHERE expires_at <= ?", (now,))
                removed += cur.rowcount if cur.rowcount > 0 else 0
                conn.commit()
        return removed

    def metrics(self) -> Dict[str, Any]:
        """Return counters + hit ratio for monitoring export."""
        with self._lock:
            total_reads = self._metrics["l1_hits"] + self._metrics["l2_hits"] + self._metrics["misses"]
            hit_ratio = (
                (self._metrics["l1_hits"] + self._metrics["l2_hits"]) / total_reads
                if total_reads
                else 0.0
            )
            return {
                **self._metrics,
                "l1_size": len(self._l1),
                "hit_ratio": round(hit_ratio, 4),
            }

    # --- Internal helpers ---

    def _l1_set(self, key: str, expires_at: float, value: Any) -> None:
        self._l1[key] = (expires_at, value)
        self._l1.move_to_end(key)

        while len(self._l1) > self.config.l1_max_items:
            self._l1.popitem(last=False)

    def _get_from_l2(self, key: str) -> Optional[tuple[float, Any]]:
        now = time.time()
        with self._db() as conn:
            row = conn.execute(
                "SELECT value_json, expires_at FROM cache_entries WHERE key = ?", (key,)
            ).fetchone()

        if not row:
            return None

        value_json, expires_at = row
        if expires_at <= now:
            return None

        return expires_at, json.loads(value_json)

    def _get_stale_if_error(self, key: str) -> Optional[Any]:
        threshold = time.time() - self.config.stale_if_error_seconds
        with self._db() as conn:
            row = conn.execute(
                """
                SELECT value_json, expires_at
                FROM cache_entries
                WHERE key = ?
                """,
                (key,),
            ).fetchone()

        if not row:
            return None

        value_json, expires_at = row
        if expires_at < threshold:
            return None

        return json.loads(value_json)

    def _set_l2(self, key: str, expires_at: float, value: Any) -> None:
        value_json = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
        now = time.time()
        with self._db() as conn:
            conn.execute(
                """
                INSERT INTO cache_entries (key, value_json, expires_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value_json=excluded.value_json,
                    expires_at=excluded.expires_at,
                    updated_at=excluded.updated_at
                """,
                (key, value_json, expires_at, now),
            )
            conn.commit()


def make_cache_key(provider: str, campaign_id: str, period: str) -> str:
    """Canonical cache key builder used by RevenueSentinel callers."""
    return f"{provider}:{campaign_id}:{period}".lower()
