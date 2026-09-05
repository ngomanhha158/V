// Chạy schema.sql + test_rls.sql trên Postgres thật (PGlite/WASM in-memory).
// Không cần cài Postgres, không cần Docker. Dùng: npm run verify
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite()

// Bài này cố ý chạy schema.sql ĐỘC LẬP, không có lớp tương thích: stub auth.uid()
// tối thiểu rồi thôi. Bản đầy đủ nằm ở scripts/verify-railway.mjs.
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

// test_rls.sql chạy cuối: nó SET ROLE + FORCE RLS, ảnh hưởng các test sau nếu chạy trước.
const files = ['schema.sql', 'seed.sql', 'test_billing.sql', 'test_tickets.sql', 'test_jobs.sql', 'test_dashboard.sql', 'test_doisoat.sql', 'test_golive.sql', 'test_nguoidung.sql', 'test_nhatky.sql', 'test_baotri.sql', 'test_banggop.sql', 'test_the.sql', 'test_xe.sql', 'test_phieu_thu.sql', 'test_quy.sql', 'test_khach.sql', 'test_tienich.sql', 'test_kienhang.sql', 'test_bangiao.sql', 'test_bieuquyet.sql', 'test_tragop.sql', 'test_catruc.sql', 'test_kho.sql', 'test_thicong.sql', 'test_baocao.sql', 'test_datoa.sql', 'test_rls.sql']
let ok = true
for (const f of files) ok = (await run(f)) && ok
process.exit(ok ? 0 : 1)
