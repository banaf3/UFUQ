# Generated runtime artifacts

Since 2026-11-02 this directory holds the artifacts written by `npm run data:generate`
(`tools/catalogue`) and listed with their hashes in `MANIFEST.v1.json`. Never hand-edit
them: change the curation or raw evidence and regenerate. `synthetic/` is the visibly
synthetic technical dataset. `local-only/` is ignored and holds the IERS Bulletin B
EOP bundle, whose redistribution terms are unconfirmed. Approval states come from
`data/approvals/`. Since Phase 3 the set includes `learning-configuration-v1.json`
(`NON_ADAPTIVE`, `REVIEW_REQUIRED`) and `synthetic/synthetic-learning-configuration-v1.json`
(adaptive technical fixture). The sky explorer adds `sky-field-hipparcos1997-v1.json`
(display-only star field, IMP-020) and `sky-culture-iau-v1.json` (IAU figures and WGSN
names), with synthetic twins.

This directory is reserved for deterministic runtime artifacts. No catalogue or
cultural data is present in the scaffold. Generated artifacts are tracked only after
licence, provenance, and release policy permits it.

Canonical textual serialization must explicitly produce UTF-8, LF line endings,
deterministic object-key and record ordering, Unicode normalization where specified,
and a defined numeric representation. Git line-ending normalization is not the
canonical serializer.
