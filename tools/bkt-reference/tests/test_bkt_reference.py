"""Offline checks of the exact-rational BKT oracle (run with python -I -m unittest)."""

from __future__ import annotations

import ast
import importlib.util
import sys
import unittest
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("bkt_reference", HERE / "bkt_reference.py")
oracle = importlib.util.module_from_spec(SPEC)
sys.modules["bkt_reference"] = oracle
SPEC.loader.exec_module(oracle)

G, S, T = Fraction(1, 5), Fraction(1, 10), Fraction(1, 10)


def run(prior: Fraction, steps: str) -> list[Fraction]:
    values = []
    for kind in steps:
        _, prior = oracle.step(prior, kind, G, S, T)
        values.append(prior)
    return values


class WorkedExamples(unittest.TestCase):
    """The specification's report examples, evaluated with exact decimal inputs."""

    def test_correct_from_point_six(self):
        posterior, nxt = oracle.step(Fraction(3, 5), "C", G, S, T)
        self.assertEqual(posterior, Fraction(27, 31))
        self.assertEqual(round(float(nxt), 12), 0.883870967742)

    def test_incorrect_from_point_six(self):
        posterior, nxt = oracle.step(Fraction(3, 5), "I", G, S, T)
        self.assertEqual(posterior, Fraction(3, 19))
        self.assertEqual(round(float(nxt), 12), 0.242105263158)

    def test_sequences_from_l0(self):
        expected = {
            "CCC": [0.576470588235, 0.873684210526, 0.971984435798],
            "III": [0.127272727273, 0.116112531969, 0.114539890399],
            "CIC": [0.576470588235, 0.230860534125, 0.617134416544],
        }
        for steps, values in expected.items():
            self.assertEqual([round(float(v), 12) for v in run(Fraction(1, 5), steps)], values, steps)

    def test_lower_fixed_point_is_exact(self):
        point = T * (1 - G) / (1 - S - G)
        self.assertEqual(point, Fraction(4, 35))
        self.assertEqual(oracle.step(point, "I", G, S, T)[1], point)

    def test_transition_only_and_no_update(self):
        self.assertEqual(oracle.step(Fraction(1, 5), "T", G, S, T), (Fraction(1, 5), Fraction(7, 25)))
        self.assertEqual(oracle.step(Fraction(1, 5), "N", G, S, T), (Fraction(1, 5), Fraction(1, 5)))


class FixtureIntegrity(unittest.TestCase):
    def test_build_is_deterministic_and_matches_the_committed_fixture(self):
        self.assertEqual(oracle.build(), oracle.build())
        self.assertEqual(oracle.main(["--check"]), 0)

    def test_inputs_are_the_exact_binary64_values(self):
        self.assertEqual(oracle.exact("0.1"), Fraction(0.1))
        self.assertNotEqual(oracle.exact("0.1"), Fraction(1, 10))

    def test_imports_only_the_standard_library(self):
        tree = ast.parse((HERE / "bkt_reference.py").read_text(encoding="utf-8"))
        modules = {
            alias.name.split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, (ast.Import, ast.ImportFrom))
            for alias in (node.names if isinstance(node, ast.Import) else [ast.alias(node.module or "")])
        }
        self.assertLessEqual(
            modules, {"__future__", "hashlib", "json", "random", "sys", "decimal", "fractions", "pathlib"}
        )


if __name__ == "__main__":
    unittest.main()
