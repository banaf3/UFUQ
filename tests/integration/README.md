# Integration-test boundary

Active since 2026-11-15 (Phase 4). The suite runs against real MySQL 8.4, never a mock,
for every transaction claim (IMP-015). It needs `UFUQ_TEST_MYSQL_URL` naming a dedicated
database whose name ends in `_test`; it drops and recreates that database's tables and
fails, instead of passing, when the variable is missing.

Locally:

```bash
npm run db:local -- init
```

```bash
UFUQ_TEST_MYSQL_URL=$(node scripts/dev/mysql-local.mjs url test) npm run test:integration
```

CI starts a MySQL 8.4 service container (`.github/workflows/ci.yml`).
