// Point everything (including ~/server/db via ~/env) at the test database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres@localhost:5433/airtable_test?host=/tmp";
process.env.SKIP_ENV_VALIDATION = "1";
process.env.AUTH_GOOGLE_ID ??= "test";
process.env.AUTH_GOOGLE_SECRET ??= "test";
