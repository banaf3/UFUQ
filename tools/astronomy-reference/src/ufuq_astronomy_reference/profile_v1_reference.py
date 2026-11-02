"""PyERFA reference for the ScientificProfileV1 geometric route (post-implementation).

This module is code-independent of the UFUQ TypeScript implementation: it imports no
production code and computes every state with ERFA (PyERFA 2.0.1.5, the BSD-licensed
derivative of IAU SOFA 2023-10-11). It is therefore SHARED_SCIENTIFIC_LINEAGE
implementation verification, not an independent scientific oracle.

Two reference paths are produced for every (instant, star) case:

* ``decomposed``: pmsafe to J2000.0 TDB, epv00, pnm06a/bpn2xy/s06, era00, sp00,
  apco with zero refraction constants, atciq, atioq. Leap seconds come from ERFA's own
  ``utctai``/``dat`` (checked against the fixture's TAI-UTC); UT1 from ``taiut1``.
* ``composed``: ``atco13`` with zero pressure (no refraction), a same-family
  consistency surface only.
"""

from __future__ import annotations

import math
import warnings
from typing import Any

import erfa

DMAS2R = math.pi / 180.0 / 3600.0 / 1000.0
DAS2R = math.pi / 180.0 / 3600.0
DJM0 = 2400000.5


def _utc_quasi_jd(utc: str) -> tuple[float, float]:
    """UTC quasi-JD in the ScientificProfileV1 MJD_ZERO_PLUS_OFFSET split."""
    date, clock = utc.rstrip("Z").split("T")
    year, month, day = (int(part) for part in date.split("-"))
    hour, minute, second = (int(part) for part in clock.split(":"))
    d1, d2 = erfa.dtf2d("UTC", year, month, day, hour, minute, float(second))
    return DJM0, (float(d1) - DJM0) + float(d2)


def _tdb_epoch(tt1: float, tt2: float) -> tuple[float, float]:
    dtr = float(erfa.dtdb(tt1, tt2, 0.0, 0.0, 0.0, 0.0))
    return tt1, tt2 + dtr / 86400.0


def compute(fixture: dict[str, Any]) -> dict[str, Any]:
    warnings.simplefilter("error", erfa.ErfaWarning)
    epoch = fixture["sourceEpoch"]["julianDate"]
    ep1a, ep1b = _tdb_epoch(float(epoch["part1"]), float(epoch["part2"]))
    observer = fixture["observer"]
    if observer["ellipsoid"] != "WGS 84":
        raise ValueError("The PyERFA reference path uses WGS 84 (apco/pvtob).")
    elong = math.radians(float(observer["geodeticLongitudeDegrees"]))
    phi = math.radians(float(observer["geodeticLatitudeDegrees"]))
    hm = float(observer["ellipsoidalHeightMetres"])

    propagated: dict[str, tuple[float, ...]] = {}
    for star in fixture["stars"]:
        if star["radialVelocityState"] != "RADIAL_VELOCITY_OMITTED_WITH_BOUND":
            raise ValueError("Only the Amendment A1 RV state is supported here.")
        dec = float(star["declinationRadians"])
        pmr = float(star["muAlphaStarMasPerYear"]) * DMAS2R / math.cos(dec)
        pmd = float(star["muDeltaMasPerYear"]) * DMAS2R
        px = float(star["parallaxMas"]) / 1000.0
        result = erfa.pmsafe(
            float(star["rightAscensionRadians"]), dec, pmr, pmd, px, 0.0,
            ep1a, ep1b, 2451545.0, 0.0,
        )
        propagated[star["starId"]] = tuple(float(value) for value in result)

    cases = []
    for instant in fixture["instants"]:
        utc1, utc2 = _utc_quasi_jd(instant["utc"])
        year, month, day, fraction = erfa.d2dtf("UTC", 9, utc1, utc2)
        dat = float(erfa.dat(int(year), int(month), int(day), 0.0))
        if dat != float(instant["taiMinusUtcSeconds"]):
            raise ValueError(f"ERFA TAI-UTC {dat} differs from fixture for {instant['utc']}.")
        tai1, tai2 = (float(v) for v in erfa.utctai(utc1, utc2))
        tt1, tt2 = (float(v) for v in erfa.taitt(tai1, tai2))
        dut1 = float(instant["ut1MinusUtcSeconds"])
        ut11, ut12 = (float(v) for v in erfa.taiut1(tai1, tai2, dut1 - dat))
        xp = float(instant["xpArcseconds"]) * DAS2R
        yp = float(instant["ypArcseconds"]) * DAS2R
        pvh, pvb = erfa.epv00(tt1, tt2)
        rbpn = erfa.pnm06a(tt1, tt2)
        x, y = (float(v) for v in erfa.bpn2xy(rbpn))
        s = float(erfa.s06(tt1, tt2, x, y))
        theta = float(erfa.era00(ut11, ut12))
        sp = float(erfa.sp00(tt1, tt2))
        astrom = erfa.apco(tt1, tt2, pvb, pvh["p"], x, y, s, theta, elong, phi, hm, xp, yp, sp, 0.0, 0.0)
        for star_id, (ra2, dec2, pmr2, pmd2, px2, rv2) in propagated.items():
            ri, di = (float(v) for v in erfa.atciq(ra2, dec2, pmr2, pmd2, px2, rv2, astrom))
            aob, zob, _hob, _dob, _rob = (float(v) for v in erfa.atioq(ri, di, astrom))
            composed = erfa.atco13(
                ra2, dec2, pmr2, pmd2, px2, rv2, utc1, utc2, dut1,
                elong, phi, hm, xp, yp, 0.0, 0.0, 0.0, 0.0,
            )
            cases.append(
                {
                    "utc": instant["utc"],
                    "starId": star_id,
                    "time": {"tai2": tai2, "tt2": tt2, "ut12": ut12},
                    "propagatedJ2000": {"ra": ra2, "dec": dec2, "pmr": pmr2, "pmd": pmd2, "px": px2, "rv": rv2},
                    "cirs": {"ri": ri, "di": di},
                    "decomposed": {"azimuth": aob, "zenithDistance": zob},
                    "composed": {"azimuth": float(composed[0]), "zenithDistance": float(composed[1])},
                }
            )
    return {
        "resultType": "UFUQ_PROFILE_V1_REFERENCE_OUTPUT",
        "schemaVersion": 1,
        "lineage": "SHARED_SCIENTIFIC_LINEAGE_IMPLEMENTATION_VERIFICATION",
        "producer": {
            "package": "pyerfa",
            "version": erfa.__version__,
            "erfaVersion": erfa.version.erfa_version,
            "sofaVersion": erfa.version.sofa_version,
        },
        "sourceEpochTdb": {"part1": ep1a, "part2": ep1b},
        "cases": cases,
    }
