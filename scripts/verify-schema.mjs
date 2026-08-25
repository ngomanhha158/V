// Chạy schema.sql + test_rls.sql trên Postgres thật (PGlite/WASM in-memory).
// Không cần cài Postgres, không cần Docker. Dùng: npm run verify
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite()

// Supabase có sẵn schema auth + auth.uid(). Local phải stub trước khi apply RLS policies.
await db.exec(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('test.uid', true), '')::uuid;
  $fn$;
`)

async function run(file) {
  try {
    await db.exec(readFileSync(join(ROOT, file), 'utf8'))
    console.log(`PASS  ${file}`)
    return true
  } catch (e) {
    console.error(`FAIL  ${file}\n      ${e.message}`)
    return false
  }
}

const ok = (await run('schema.sql')) && (await run('test_rls.sql'))
process.exit(ok ? 0 : 1)
