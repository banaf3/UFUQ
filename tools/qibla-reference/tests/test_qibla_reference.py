"""Self-tests of the independent Qibla oracle (standard library only)."""

from __future__ import annotations

import ast
import sys
import unittest
from decimal import Decimal
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

import qibla_reference as oracle  # noqa: E402


class QiblaOracleTests(unittest.TestCase):
    def test_due_north_on_the_destination_meridian(self) -> None:
        bearing = oracle.bearing("0", oracle.DESTINATION[1])
        self.assertLess(min(abs(bearing), abs(bearing - 360)), Decimal("1e-30"))

    def test_series_functions(self) -> None:
        self.assertLess(abs(oracle.sin(oracle.PI / 6) - Decimal("0.5")), Decimal("1e-40"))
        self.assertLess(abs(oracle.atan(Decimal(1)) - oracle.PI / 4), Decimal("1e-40"))
        self.assertLess(abs(oracle.atan2(Decimal(-1), Decimal(-1)) + 3 * oracle.PI / 4), Decimal("1e-40"))

    def test_pekan_is_in_the_malaysian_range(self) -> None:
        bearing = oracle.bearing("3.5466545", "103.4273953")
        self.assertTrue(Decimal(291) < bearing < Decimal(293))

    def test_fixture_rebuilds_byte_identically(self) -> None:
        self.assertEqual(oracle.build(), oracle.OUTPUT.read_text(encoding="utf-8"))

    def test_imports_only_the_standard_library(self) -> None:
        tree = ast.parse((HERE / "qibla_reference.py").read_text(encoding="utf-8"))
        modules = {
            alias.name.split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        } | {
            (node.module or "").split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom)
        }
        self.assertTrue(modules <= {"__future__", "hashlib", "json", "sys", "decimal", "pathlib"})


if __name__ == "__main__":
    unittest.main()
