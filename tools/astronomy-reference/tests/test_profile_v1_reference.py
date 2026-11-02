"""Replay test for the post-implementation ProfileV1 PyERFA reference output."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from ufuq_astronomy_reference import canonical_bytes, sha256_bytes  # noqa: E402
from ufuq_astronomy_reference.profile_v1_reference import compute  # noqa: E402

FIXTURES = PROJECT_ROOT / "fixtures"


class ProfileV1ReferenceReplayTest(unittest.TestCase):
    def test_committed_output_replays_byte_identically(self) -> None:
        fixture = json.loads((FIXTURES / "profile-v1-reference-input.v1.json").read_text("utf-8"))
        expected = (FIXTURES / "profile-v1-reference-output.v1.json").read_bytes()
        recorded = (FIXTURES / "profile-v1-reference-output.v1.sha256").read_text("ascii").strip()
        produced = canonical_bytes(compute(fixture))
        self.assertEqual(produced, expected)
        self.assertEqual(sha256_bytes(produced), recorded)

    def test_reference_declares_shared_lineage(self) -> None:
        output = json.loads((FIXTURES / "profile-v1-reference-output.v1.json").read_text("utf-8"))
        self.assertEqual(output["lineage"], "SHARED_SCIENTIFIC_LINEAGE_IMPLEMENTATION_VERIFICATION")
        self.assertEqual(output["producer"]["sofaVersion"], "20231011")

    def test_decomposed_and_composed_paths_agree(self) -> None:
        output = json.loads((FIXTURES / "profile-v1-reference-output.v1.json").read_text("utf-8"))
        for case in output["cases"]:
            self.assertAlmostEqual(
                case["decomposed"]["zenithDistance"], case["composed"]["zenithDistance"], delta=1e-12
            )


if __name__ == "__main__":
    unittest.main()
