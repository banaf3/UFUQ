"""Independent spherical Qibla-bearing oracle for UFUQ (report NFR-2, IMP-023).

Standard-library only. It never imports or reads production code. Where the runtime uses
the atan2 form of the spherical initial bearing, this oracle uses a different method:
unit position vectors on the sphere, the observer's local east and north unit vectors,
and the bearing of the great-circle plane normal, all in 50-digit decimal arithmetic
with its own series for sin, cos and atan. The fixture therefore checks the runtime
against an independent derivation of the same spherical model.

Usage:
    python -I tools/qibla-reference/qibla_reference.py           # write the fixture
    python -I tools/qibla-reference/qibla_reference.py --check   # byte-compare the fixture
"""

from __future__ import annotations

import hashlib
import json
import sys
from decimal import Decimal, getcontext
from pathlib import Path

GENERATOR_ID = "ufuq-qibla-reference"
GENERATOR_VERSION = "1"
getcontext().prec = 50
HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "fixtures" / "qibla-reference-output.v1.json"
DIGEST = HERE / "fixtures" / "qibla-reference-output.v1.sha256"

# The candidate destination record (curation data/curation/relationships, AST-005). Its
# value is an input here, not something this oracle approves.
DESTINATION = ("21.4225079", "39.8261890")

CASES = [
    # (case id, latitude, longitude): Malaysian observers, both hemispheres, the
    # meridian, the equator, wrap across 180 degrees and a near-destination point.
    ("umpsa-pekan-faculty", "3.5466545", "103.4273953"),
    ("kuala-lumpur-sample", "3.1390", "101.6869"),
    ("kota-kinabalu-sample", "5.9804", "116.0735"),
    ("equator-meridian-of-destination", "0", "39.8261890"),
    ("southern-hemisphere-sample", "-33.8688", "151.2093"),
    ("western-hemisphere-sample", "40.7128", "-74.0060"),
    ("wrap-east-of-180", "-17.7134", "178.0650"),
    ("high-north-sample", "64.1466", "-21.9426"),
    ("near-destination-north", "21.5000", "39.8261890"),
    ("near-destination-east", "21.4225079", "39.9000"),
]

PI = Decimal("3.14159265358979323846264338327950288419716939937510")


def sin(x: Decimal) -> Decimal:
    x = x % (2 * PI)
    term, total, n = x, x, 1
    while True:
        term = -term * x * x / ((2 * n) * (2 * n + 1))
        if abs(term) < Decimal("1e-60"):
            return total
        total += term
        n += 1


def cos(x: Decimal) -> Decimal:
    return sin(x + PI / 2)


def atan(x: Decimal) -> Decimal:
    # Argument reduction: atan(x) = 2 atan(x / (1 + sqrt(1 + x^2))), then the series.
    if x < 0:
        return -atan(-x)
    if x > 1:
        return PI / 2 - atan(1 / x)
    for _ in range(4):
        x = x / (1 + (1 + x * x).sqrt())
    term, total, n = x, x, 1
    while True:
        term = -term * x * x
        add = term / (2 * n + 1)
        if abs(add) < Decimal("1e-60"):
            return total * 16
        total += add
        n += 1


def atan2(y: Decimal, x: Decimal) -> Decimal:
    if x > 0:
        return atan(y / x)
    if x < 0:
        return atan(y / x) + (PI if y >= 0 else -PI)
    return PI / 2 if y > 0 else -PI / 2


def unit(lat: Decimal, lon: Decimal):
    return (cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def bearing(lat_text: str, lon_text: str) -> Decimal:
    rad = PI / 180
    lat, lon = Decimal(lat_text) * rad, Decimal(lon_text) * rad
    p = unit(lat, lon)
    q = unit(Decimal(DESTINATION[0]) * rad, Decimal(DESTINATION[1]) * rad)
    east = (-sin(lon), cos(lon), Decimal(0))
    north = (-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat))
    # The great circle through p and q has normal n = p x q; its initial direction at p
    # is t = n x p, the tangent pointing towards q.
    t = cross(cross(p, q), p)
    azimuth = atan2(dot(t, east), dot(t, north)) / rad
    return azimuth + 360 if azimuth < 0 else azimuth


def build() -> str:
    cases = [
        {
            "caseId": case_id,
            "observer": {"latitudeDegrees": lat, "longitudeDegrees": lon},
            "expectedAzimuthDegrees": format(round(bearing(lat, lon), 12), "f"),
        }
        for case_id, lat, lon in CASES
    ]
    document = {
        "generatorId": GENERATOR_ID,
        "generatorVersion": GENERATOR_VERSION,
        "model": "SPHERICAL_INITIAL_GREAT_CIRCLE_BEARING",
        "method": "unit vectors and local east/north frame, 50-digit decimal",
        "destination": {"latitudeDegrees": DESTINATION[0], "longitudeDegrees": DESTINATION[1]},
        "cases": cases,
    }
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    text = build()
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if "--check" in sys.argv:
        if OUTPUT.read_text(encoding="utf-8") != text or DIGEST.read_text().split()[0] != digest:
            print("Qibla reference fixture is stale.", file=sys.stderr)
            return 1
        print(f"Qibla reference fixture verified ({len(CASES)} cases).")
        return 0
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(text, encoding="utf-8", newline="\n")
    DIGEST.write_text(f"{digest}  {OUTPUT.name}\n", encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT} ({len(CASES)} cases).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
