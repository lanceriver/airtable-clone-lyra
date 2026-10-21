// Vercel runs `npm run vercel-build` instead of `build` when it exists.
// Production deploys apply pending migrations first; preview deploys never
// touch the database. Set DIRECT_URL to a non-pooled connection string if
// DATABASE_URL goes through a pooler (e.g. Neon's "-pooler" host), since
// migrations need session-level advisory locks.
import { execSync } from "node:child_process";

const run = (command, env = process.env) =>
  execSync(command, { stdio: "inherit", env });

if (process.env.VERCEL_ENV === "production") {
  const migrateUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  run("npx prisma migrate deploy", { ...process.env, DATABASE_URL: migrateUrl });
} else {
  console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}

run("npx next build");
