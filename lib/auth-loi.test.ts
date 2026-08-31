import test from 'node:test'
import assert from 'node:assert/strict'
import { dichLoiAuth } from './auth-loi.ts'

test('hết lượt gửi thư: nói rõ là lỗi HỆ THỐNG, không phải người dùng nhập sai', () => {
  const a = dichLoiAuth({ code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' })
  assert.match(a, /giới hạn của hệ thống/)
  assert.match(a, /không phải do bạn/)
  // Phải có việc để làm, không chỉ mô tả sự cố
  assert.match(a, /một giờ|ban quản lý/)
  // Khớp cả khi supabase-js cũ không trả code
  assert.equal(dichLoiAuth({ message: 'Email rate limit exceeded' }), a)
})

test('thời gian chờ giữa hai lần gửi: lấy ra đúng số giây', () => {
  assert.match(
    dichLoiAuth({ message: 'For security purposes, you can only request this after 47 seconds.' }),
    /chờ 47 giây/,
  )
  assert.match(
    dichLoiAuth({ message: 'you can only request this after 9 second' }),
    /chờ 9 giây/,
  )
})

test('mã hết hạn khác với mã nhập sai — hai việc phải làm khác nhau', () => {
  assert.match(dichLoiAuth({ code: 'otp_expired' }), /Gửi lại mã/)
  assert.match(dichLoiAuth({ code: 'invalid_credentials' }), /Kiểm tra lại dãy số/)
})

test('lỗi mạng của trình duyệt không đổ cho máy chủ', () => {
  assert.match(dichLoiAuth({ message: 'Failed to fetch' }), /Kiểm tra mạng/)
})

test('lỗi lạ thì trả NGUYÊN VĂN, không nuốt thành "có lỗi xảy ra"', () => {
  const la = 'Something entirely new from Supabase'
  assert.equal(dichLoiAuth({ message: la }), la)
})

test('không có lỗi thì không vỡ', () => {
  assert.match(dichLoiAuth(null), /lỗi/)
  assert.match(dichLoiAuth({}), /lỗi/)
})
