// Validates supabase/migrations/*.sql + seed.sql against an in-memory Postgres (PGlite).
// Stubs the Supabase-managed auth schema (auth.users, auth.uid(), auth.jwt()).
// Usage: node scripts/validate-migrations.mjs  (requires: npm i @electric-sql/pglite)

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();

// --- Supabase environment stubs ---
await db.exec(`
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
  -- pgcrypto isn't bundled in PGlite; stub digest() (md5-based — validation only).
  -- Real Supabase has pgcrypto enabled; seed.sql uses true sha256 there.
  CREATE FUNCTION digest(t text, algo text) RETURNS bytea
    LANGUAGE sql IMMUTABLE AS $$ SELECT decode(md5(t || algo), 'hex') $$;
`);

const dir = join(root, "supabase", "migrations");
for (const f of readdirSync(dir).sort()) {
  process.stdout.write(`migration ${f} ... `);
  await db.exec(readFileSync(join(dir, f), "utf8"));
  console.log("OK");
}

process.stdout.write("seed.sql ... ");
await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
console.log("OK");

// --- Sanity queries ---
const checks = [
  ["members seeded", "SELECT count(*)::int AS n FROM gym_members", (r) => r.n === 5],
  ["check-in history seeded", "SELECT count(*)::int AS n FROM check_ins", (r) => r.n > 50],
  ["payment default is pending (D-05)",
    "SELECT column_default LIKE '%pending%' AS ok FROM information_schema.columns WHERE table_name='memberships' AND column_name='payment_status'",
    (r) => r.ok === true],
  ["dob exists on profiles (D-04)",
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='profiles' AND column_name='date_of_birth'",
    (r) => r.n === 1],
  ["no FOR ALL / DELETE policies (D-03)",
    "SELECT count(*)::int AS n FROM pg_policies WHERE cmd IN ('ALL','DELETE')",
    (r) => r.n === 0],
  ["RLS enabled on all public tables",
    "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity",
    (r) => r.n === 0],
  ["coach-who-is-member row exists (D-06)",
    "SELECT count(*)::int AS n FROM gym_members WHERE 'coach' = ANY(roles) AND 'member' = ANY(roles)",
    (r) => r.n === 1],
];

let failed = 0;
for (const [name, sql, ok] of checks) {
  const { rows } = await db.query(sql);
  const pass = ok(rows[0]);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) failed++;
}
process.exit(failed ? 1 : 0);
