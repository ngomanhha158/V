import { test } from 'node:test'
import assert from 'node:assert/strict'
import { docThe, kyThe } from './the.ts'
import { doc, ky } from './db/jwt.ts'

const BI_MAT = 'z'.repeat(48)
const AI = '11111111-2222-3333-4444-555555555555'
const CAN = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

test('ký rồi đọc lại ra đúng người và đúng căn', () => {
  const t = docThe(kyThe(AI, CAN, BI_MAT), BI_MAT)
  assert.equal(t?.uid, AI)
  assert.equal(t?.unit, CAN)
})

test('sai khóa thì không đọc được', () => {
  assert.equal(docThe(kyThe(AI, CAN, BI_MAT), 'y'.repeat(48)), null)
})

test('đổi một byte trong thân thì chữ ký hỏng', () => {
  // Đây là cả điểm của chữ ký: phần thân là base64 chứ không phải mật mã, nên
  // ai cũng sửa được số căn thành căn nhà người khác.
  const b = Buffer.from(kyThe(AI, CAN, BI_MAT), 'base64url')
  for (const i of [0, 15, 16, 31, 35, 40, 51]) {
    const x = Buffer.from(b); x[i] ^= 0x01
    assert.equal(docThe(x.toString('base64url'), BI_MAT), null, `byte ${i} sửa được`)
  }
})

test('hết hạn thì trả null, kể cả chữ ký đúng', () => {
  const bay = Date.parse('2026-09-02T00:00:00Z')
  const t = kyThe(AI, CAN, BI_MAT, 60, bay)
  assert.notEqual(docThe(t, BI_MAT, bay + 59_000), null)
  assert.equal(docThe(t, BI_MAT, bay + 61_000), null)
  assert.equal(docThe(t, BI_MAT, bay + 60_000), null)
})

test('MÃ THẺ KHÔNG DÙNG ĐƯỢC LÀM PHIÊN ĐĂNG NHẬP', async () => {
  // Chốt quan trọng nhất file này. Hai thứ ký bằng CÙNG một khóa: ai chụp được
  // ảnh mã QR mà đổi được nó thành phiên đăng nhập thì thẻ cư dân trở thành
  // đường vào tài khoản của chính cư dân đó.
  const ma = kyThe(AI, CAN, BI_MAT)
  assert.equal(await doc(ma, BI_MAT), null)
})

test('PHIÊN ĐĂNG NHẬP KHÔNG DÙNG ĐƯỢC LÀM MÃ THẺ', async () => {
  // Chiều ngược lại: người đang đăng nhập không được tự biến token của mình
  // thành một tấm thẻ vào căn bất kỳ.
  const phien = await ky(AI, 'authenticated', BI_MAT, 3600)
  assert.equal(docThe(phien, BI_MAT), null)
})

test('rác không làm văng, chỉ là không hợp lệ', () => {
  for (const x of ['', 'abc', 'a.b.c', '!!!!', 'A'.repeat(51), 'A'.repeat(53), undefined, null]) {
    assert.equal(docThe(x as string, BI_MAT), null, `mã ${JSON.stringify(x)}`)
  }
})

test('mã đủ ngắn để in ra QR thưa ô', () => {
  // 52 byte -> 70 ký tự base64url. Cộng tên miền vẫn nằm trong ngưỡng QR cỡ
  // nhỏ. Dài ra là ô nhỏ đi, và bảo vệ phải soi lại lần nữa ở sảnh thiếu sáng.
  assert.equal(kyThe(AI, CAN, BI_MAT).length, 70)
})

test('hai lần ký trong cùng một giây cho cùng một mã', () => {
  // Không có phần ngẫu nhiên: mã đổi theo THỜI GIAN chứ không theo lần gọi.
  // Nếu mỗi lần gọi ra một mã khác thì trang thẻ tự làm hỏng mã nó vừa hiện.
  const bay = Date.parse('2026-09-02T00:00:00Z')
  assert.equal(kyThe(AI, CAN, BI_MAT, 60, bay), kyThe(AI, CAN, BI_MAT, 60, bay + 999))
})
