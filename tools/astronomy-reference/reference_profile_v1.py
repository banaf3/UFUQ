"""Entry point for the post-implementation ScientificProfileV1 PyERFA reference.

Kept separate from run.py, whose bytes are frozen by the Milestone 2C.5B Batch 01
evidence. Usage (from this directory):

    uv run --locked --no-sync python reference_profile_v1.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from ufuq_astronomy_reference import canonical_bytes, sha256_bytes  # noqa: E402
from ufuq_astronomy_reference.profile_v1_reference import compute  # noqa: E402


def main() -> None:
    fixtures = PROJECT_ROOT / "fixtures"
    fixture = json.loads((fixtures / "profile-v1-reference-input.v1.json").read_text("utf-8"))
    output = canonical_bytes(compute(fixture))
    (fixtures / "profile-v1-reference-output.v1.json").write_bytes(output)
    digest = sha256_bytes(output) + "\n"
    (fixtures / "profile-v1-reference-output.v1.sha256").write_bytes(digest.encode("ascii"))
    print(f"Wrote {len(json.loads(output))} keys; sha256 {digest.strip()}")


if __name__ == "__main__":
    main()
