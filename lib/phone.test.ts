import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmail, toE164VN } from './phone.ts'

test('số nội địa có 0 đầu -> E.164', () => {
  assert.equal(toE164VN('0901234567'), '+84901234567')
  assert.equal(toE164VN('0912345678'), '+84912345678')
})

test('bỏ được dấu cách, chấm, gạch, ngoặc mà người ta hay gõ', () => {
  assert.equal(toE164VN('090 123 45 67'), '+84901234567')
  assert.equal(toE164VN('090.123.4567'), '+84901234567')
  assert.equal(toE164VN('(090) 123-4567'), '+84901234567')
  assert.equal(toE164VN('  0901234567  '), '+84901234567')
})

test('đã ở dạng +84 hoặc 84 thì giữ nguyên phần thân', () => {
  assert.equal(toE164VN('+84901234567'), '+84901234567')
  assert.equal(toE164VN('84901234567'), '+84901234567')
  assert.equal(toE164VN('+84 90 123 4567'), '+84901234567')
})

test('+84 mà vẫn giữ số 0 thừa: +84 0901234567', () => {
  // Kiểu gõ rất hay gặp khi copy từ danh bạ rồi thêm mã nước bằng tay.
  // Không xử lý thì ra +840901234567 — sai 1 chữ số, Supabase từ chối.
  assert.equal(toE164VN('+840901234567'), '+84901234567')
})

test('gõ trần không có số 0 đầu', () => {
  assert.equal(toE164VN('901234567'), '+84901234567')
})

test('số cố định và số sai độ dài bị từ chối', () => {
  assert.equal(toE164VN('02812345678'), null)  // cố định TP.HCM, không nhận SMS
  assert.equal(toE164VN('024 3825 1234'), null) // cố định Hà Nội
  assert.equal(toE164VN('090123456'), null)     // thiếu 1 số
  assert.equal(toE164VN('09012345678'), null)   // thừa 1 số
  assert.equal(toE164VN('0101234567'), null)    // đầu số không tồn tại
})

test('rác thì trả null chứ không ném lỗi', () => {
  assert.equal(toE164VN(''), null)
  assert.equal(toE164VN('   '), null)
  assert.equal(toE164VN('khong phai so'), null)
  assert.equal(toE164VN('+'), null)
})

test('email hạ chữ thường và cắt khoảng trắng', () => {
  assert.equal(normalizeEmail('  Ngo.Manh.Ha@Gmail.COM '), 'ngo.manh.ha@gmail.com')
})

test('email sai rõ ràng thì từ chối', () => {
  assert.equal(normalizeEmail('khong-co-a-cong'), null)
  assert.equal(normalizeEmail('thieu@ten-mien'), null)
  assert.equal(normalizeEmail('co khoang trang@gmail.com'), null)
  assert.equal(normalizeEmail('@gmail.com'), null)
})
