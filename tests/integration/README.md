# Integration-test placeholder

The integration suite intentionally has no database or authentication cases in Phase 0.

Add future `.test.ts` or `.test.tsx` cases here and run `npm run test:integration`.
`vitest.integration.config.ts` owns discovery; ordinary unit and browser tests are excluded.
Tooling regressions prove discovery/failure propagation without claiming MySQL coverage.
