import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doc, ky } from './jwt.ts'

const BI_MAT = 'x'.repeat(48)
const AI = '11111111-2222-3333-4444-555555555555'

test('ký rồi đọc lại ra đúng người và đúng vai', async () => {
  const t = await ky(AI, 'authenticated', BI_MAT, 3600)
  const c = await doc(t, BI_MAT)
  assert.equal(c?.sub, AI)
  assert.equal(c?.role, 'authenticated')
})

test('sai khóa thì không đọc được, dù token nguyên vẹn', async () => {
  const t = await ky(AI, 'authenticated', BI_MAT, 3600)
  assert.equal(await doc(t, 'y'.repeat(48)), null)
})

test('sửa sub trong token thì chữ ký hỏng', async () => {
  // Phần giữa của JWT là base64 chứ không phải mật mã. Đây là cả lý do phải
  // kiểm chữ ký thay vì chỉ giải mã ra xem là ai.
  const t = await ky(AI, 'authenticated', BI_MAT, 3600)
  const [d, _g, k] = t.split('.')
  const gia = Buffer.from(JSON.stringify({
    sub: '99999999-9999-9999-9999-999999999999', role: 'authenticated',
    iat: 1, exp: 9999999999,
  })).toString('base64url')
  assert.equal(await doc(`${d}.${gia}.${k}`, BI_MAT), null)
})

test('tự nâng vai lên service_role cũng hỏng chữ ký', async () => {
  const t = await ky(AI, 'authenticated', BI_MAT, 3600)
  const [d, g, k] = t.split('.')
  const than = JSON.parse(Buffer.from(g, 'base64url').toString())
  than.role = 'service_role'
  const gia = Buffer.from(JSON.stringify(than)).toString('base64url')
  assert.equal(await doc(`${d}.${gia}.${k}`, BI_MAT), null)
})

test('hết hạn thì trả null, kể cả chữ ký đúng', async () => {
  const bay = Date.parse('2026-09-02T00:00:00Z')
  const t = await ky(AI, 'authenticated', BI_MAT, 60, bay)
  assert.notEqual(await doc(t, BI_MAT, bay + 59_000), null)
  assert.equal(await doc(t, BI_MAT, bay + 61_000), null)
  // Đúng giây hết hạn là ĐÃ hết, không phải còn.
  assert.equal(await doc(t, BI_MAT, bay + 60_000), null)
})

test('token rác không làm văng, chỉ là chưa đăng nhập', async () => {
  for (const x of ['', 'abc', 'a.b', 'a.b.c', 'a.b.c.d', '...', undefined, null]) {
    assert.equal(await doc(x as string, BI_MAT), null, `token ${JSON.stringify(x)}`)
  }
})

test('vai lạ bị từ chối, không mặc định thành gì cả', async () => {
  const t = await ky(AI, 'nguoi_quan_tri' as 'authenticated', BI_MAT, 3600)
  assert.equal(await doc(t, BI_MAT), null)
})

test('token service_role không mang tên ai', async () => {
  // auth.uid() phải trả NULL cho token này. Có sub nghĩa là hàm SECURITY
  // DEFINER nào đó sẽ ghi tên một người không hề tồn tại vào sổ.
  const t = await ky(null, 'service_role', BI_MAT, 60)
  const than = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())
  assert.equal(than.sub, undefined)
  assert.equal(than.role, 'service_role')
})
