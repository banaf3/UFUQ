# Exact-rational BKT reference oracle

`bkt_reference.py` evaluates the four-parameter BKT update of `docs/TUTORING_BKT_SPEC.md`
(posterior, then one learning transition) with `fractions.Fraction`, so every expected
value is exact before printing. It uses only the CPython standard library, imports no
production code and is not an npm workspace.

Inputs are read as the exact binary64 values of their decimal text, the same values the
TypeScript implementation receives, so `tests/reference/bkt-reference.test.ts` measures
only the implementation's rounding error. That test applies a per-value first-order
forward-error bound (see the test header and `docs/PHASE3_ASSESSMENT_AND_BKT.md`).

| File | Role |
|---|---|
| `bkt_reference.py` | Writes or `--check`s the fixture: 14 named cases plus 120 seeded by `random.Random(20261102)` |
| `fixtures/bkt-reference-output.v1.json` | Committed oracle output, one case per line |
| `fixtures/bkt-reference-output.v1.sha256` | SHA-256 the reference test verifies |
| `tests/test_bkt_reference.py` | Exact worked examples, the fixed point, rebuild determinism, import guard |

Run with the uv-managed interpreter (`uv python find 3.14.6` prints its path):

```text
python -I tools/bkt-reference/bkt_reference.py --check
python -I -m unittest discover -s tools/bkt-reference/tests
```

Regenerate (without `--check`) only when the case list changes, and commit the fixture
and its hash together.
