"""Exact-rational BKT reference oracle for UFUQ (TUTORING_BKT_SPEC.md, ADR-005).

Standard-library only. It never imports or reads production code: it states the four-
parameter BKT update from the specification and evaluates it with fractions.Fraction, so
every expected value is exact before it is printed. Inputs are interpreted as the exact
binary64 value of their decimal text, which is what the TypeScript implementation
receives; the comparison therefore measures only the implementation's rounding error.

Usage:
    python -I tools/bkt-reference/bkt_reference.py           # write the fixture
    python -I tools/bkt-reference/bkt_reference.py --check   # byte-compare the fixture
"""

from __future__ import annotations

import hashlib
import json
import random
import sys
from decimal import Decimal, localcontext
from fractions import Fraction
from pathlib import Path

GENERATOR_ID = "ufuq-bkt-reference"
GENERATOR_VERSION = "1"
SEED = 20261102
RANDOM_CASES = 120
DIGITS = 25
HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "fixtures" / "bkt-reference-output.v1.json"
DIGEST = HERE / "fixtures" / "bkt-reference-output.v1.sha256"


def exact(text: str) -> Fraction:
    """The exact value of the binary64 number nearest to the decimal text."""
    return Fraction(float(text))


def decimal_text(value: Fraction) -> str:
    """A fixed 25-significant-digit rendering (far beyond binary64 precision)."""
    if value == 0:
        return "0"
    with localcontext() as context:
        context.prec = DIGITS
        rendered = Decimal(value.numerator) / Decimal(value.denominator)
    return format(rendered, "f") if abs(rendered) >= Decimal("1e-6") else format(rendered, "e")


def step(prior: Fraction, kind: str, guess: Fraction, slip: Fraction, learn: Fraction):
    """One specification update: likelihood posterior (if any), then one transition."""
    if kind == "N":
        return prior, prior
    if kind == "T":
        posterior = prior
    elif kind == "C":
        mastered = prior * (1 - slip)
        posterior = mastered / (mastered + (1 - prior) * guess)
    elif kind == "I":
        mastered = prior * slip
        posterior = mastered / (mastered + (1 - prior) * (1 - guess))
    else:
        raise ValueError(kind)
    return posterior, posterior + (1 - posterior) * learn


def evaluate(case: dict) -> dict:
    parameters = case["parameters"]
    guess = exact(parameters["guess"])
    slip = exact(parameters["slip"])
    learn = exact(parameters["learn"])
    prior = exact(case["start"] if case["start"] is not None else parameters["initialMastery"])
    if not 1 - slip > guess:
        raise ValueError(f"{case['caseId']}: 1 - S must exceed G")
    points = []
    for kind in case["steps"]:
        posterior, nxt = step(prior, kind, guess, slip, learn)
        points.append(
            {"prior": decimal_text(prior), "posterior": decimal_text(posterior), "next": decimal_text(nxt)}
        )
        prior = nxt
    return {**case, "expected": points}


def named_cases() -> list[dict]:
    report = {"initialMastery": "0.2", "learn": "0.1", "guess": "0.2", "slip": "0.1"}
    cases = [
        ("report-correct-x3", report, None, "CCC"),
        ("report-incorrect-x3", report, None, "III"),
        ("report-correct-incorrect-correct", report, None, "CIC"),
        ("report-prior-0.60-correct", report, "0.6", "C"),
        ("report-prior-0.60-incorrect", report, "0.6", "I"),
        ("report-transition-only-and-no-update", report, None, "TNTCIN"),
        ("report-prior-zero", report, "0", "CIT"),
        ("report-prior-one", report, "1", "ICT"),
        ("report-near-fixed-point", report, "0.1142857142857143", "IIIIII"),
        ("report-long-correct-run", report, None, "C" * 20),
        ("report-long-incorrect-run", report, None, "I" * 20),
        ("small-guess-slip", {"initialMastery": "0.01", "learn": "0.05", "guess": "0.01", "slip": "0.01"}, None, "CCCIIC"),
        ("high-guess-slip", {"initialMastery": "0.5", "learn": "0.3", "guess": "0.45", "slip": "0.45"}, None, "CICICI"),
        ("no-learning", {"initialMastery": "0.3", "learn": "0", "guess": "0.25", "slip": "0.15"}, None, "CCIICT"),
    ]
    return [
        {"caseId": case_id, "parameters": parameters, "start": start, "steps": steps}
        for case_id, parameters, start, steps in cases
    ]


def random_cases() -> list[dict]:
    """Seeded cases from random.Random(SEED).random(), whose sequence CPython guarantees."""
    generator = random.Random(SEED)

    def draw(low: float, high: float) -> str:
        return f"{low + (high - low) * generator.random():.6f}"

    cases = []
    for index in range(RANDOM_CASES):
        parameters = {
            "initialMastery": draw(0.01, 0.99),
            "learn": draw(0.0, 0.5),
            "guess": draw(0.01, 0.45),
            "slip": draw(0.01, 0.45),
        }
        length = 1 + int(generator.random() * 12)
        steps = "".join("CITN"[min(3, int(generator.random() * 4))] for _ in range(length))
        cases.append({"caseId": f"seeded-{index:03d}", "parameters": parameters, "start": None, "steps": steps})
    return cases


def build() -> str:
    cases = [evaluate(case) for case in named_cases() + random_cases()]
    document = {
        "fixtureType": "UFUQ_BKT_REFERENCE",
        "schemaVersion": 1,
        "generator": {"id": GENERATOR_ID, "version": GENERATOR_VERSION, "runtime": "CPython 3 standard library only"},
        "model": "STANDARD_BKT_FOUR_PARAMETER v1: posterior then one learning transition",
        "arithmetic": "fractions.Fraction (exact), printed with 25 significant digits",
        "inputInterpretation": "EXACT_BINARY64_VALUE_OF_DECIMAL_TEXT",
        "stepCodes": {"C": "correct observation", "I": "incorrect observation", "T": "transition only", "N": "no model update"},
        "random": {"seed": SEED, "generator": "CPython random.Random (MT19937) .random()", "caseCount": RANDOM_CASES},
        "cases": cases,
    }
    def compact(value: object) -> str:
        return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))

    # One case per line keeps the fixture reviewable in diffs.
    header = [f"{json.dumps(key)}:{compact(document[key])}" for key in sorted(document) if key != "cases"]
    body = ",\n".join(compact(case) for case in document["cases"])
    return "{\n" + ",\n".join(header) + ',\n"cases":[\n' + body + "\n]}\n"


def main(argv: list[str]) -> int:
    text = build()
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest() + "\n"
    if "--check" in argv:
        same = OUTPUT.read_text(encoding="utf-8") == text and DIGEST.read_text(encoding="utf-8") == digest
        print("BKT reference fixture is byte-identical." if same else "BKT reference fixture differs.")
        return 0 if same else 1
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")
    DIGEST.write_text(digest, encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT.name} ({len(text)} bytes, sha256 {digest.strip()}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
