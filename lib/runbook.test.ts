import test from 'node:test'
import assert from 'node:assert/strict'
import { docNguon } from './soat-nguon.ts'

/**
 * Runbook dựng production phải áp ĐÚNG những file mà CI áp.
 *
 * Hai danh sách này từng lệch nhau và không ai biết: `verify-railway.mjs` áp
 * schema.sql + auth_hooks.sql, còn railway/GD1-runbook.sh thì không — nó chỉ
 * tải bốn file của lớp tương thích và lớp đăng nhập. Nên CI xanh trong khi
 * database production thiếu hẳn phần lớn hệ thống, và chuyện đó chỉ lộ ra ở
 * một dòng log lẻ: "Could not find the function public.job_ghi_nhan(...)".
 *
 * CI là thứ chứng minh ngăn xếp chạy được. Runbook là thứ NGƯỜI dựng làm theo.
 * Hai bản danh sách thì sớm muộn cũng lệch, và bên lệch luôn là bên không ai
 * chạy hằng ngày.
 */

/** File chỉ dùng để dựng/soát trong CI, không thuộc quy trình dựng thật. */
const CHI_CI = ['seed.sql', 'railway/02_smoke_prod.sql', 'railway/04_smoke_auth.sql']

function fileCuaCI(): string[] {
  const src = docNguon('scripts/verify-railway.mjs')
  const i = src.indexOf('const FILES = [')
  assert.notEqual(i, -1, 'không tìm thấy danh sách FILES trong verify-railway.mjs')
  const khoi = src.slice(i, src.indexOf(']', i))
  return [...khoi.matchAll(/'([^']+\.sql)'/g)]
    .map((m) => m[1])
    .filter((f) => !CHI_CI.includes(f))
}

function fileCuaRunbook(): string[] {
  const src = docNguon('railway/GD1-runbook.sh')
  return [...src.matchAll(/^psql .*-f (\S+\.sql)/gm)].map((m) => m[1])
}

test('runbook áp đủ mọi file SQL mà CI áp', () => {
  // So theo TÊN TỆP: runbook chạy trong /tmp sau khi curl về nên mất phần
  // thư mục, còn CI đọc thẳng từ gốc repo.
  const ten = (f: string) => f.split('/').pop()!
  const can = fileCuaCI().map(ten)
  const co = fileCuaRunbook().map(ten)
  const thieu = can.filter((f) => !co.includes(f))
  assert.deepEqual(thieu, [],
    `runbook thiếu: ${thieu.join(', ')} — người dựng làm theo nó sẽ có một `
    + 'database không đủ hàm cho app gọi')
})

test('runbook giữ đúng thứ tự: compat → schema → auth_hooks → auth', () => {
  // auth_hooks.sql thu hồi quyền nền rồi cấp lại, nên chạy trước schema là thu
  // hồi trên những bảng chưa tồn tại — hỏng theo kiểu không đỏ.
  const co = fileCuaRunbook().map((f) => f.split('/').pop()!)
  const vt = (f: string) => co.indexOf(f)
  assert.ok(vt('00_compat.sql') >= 0 && vt('schema.sql') > vt('00_compat.sql'),
    'schema.sql phải chạy sau 00_compat.sql')
  assert.ok(vt('auth_hooks.sql') > vt('schema.sql'),
    'auth_hooks.sql phải chạy SAU schema.sql')
  assert.ok(vt('03_auth.sql') > vt('auth_hooks.sql'),
    '03_auth.sql phải chạy sau auth_hooks.sql')
})

test('runbook tải về đúng những file nó sắp chạy', () => {
  // Chạy một file chưa curl về thì psql đỏ ở giữa chừng — sau khi một phần đã
  // áp, đúng trạng thái khó gỡ nhất.
  const src = docNguon('railway/GD1-runbook.sh')
  const i = src.indexOf('for f in ')
  const khoi = src.slice(i, src.indexOf('done', i))
  for (const f of fileCuaRunbook()) {
    assert.ok(khoi.includes(f.split('/').pop()!), `runbook chạy ${f} mà không tải về`)
  }
})
