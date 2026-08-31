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

test('sai mật khẩu không được nói thành "kiểm tra dãy số trong thư"', () => {
  const mk = dichLoiAuth({ code: 'invalid_credentials' }, 'matkhau')
  assert.match(mk, /mật khẩu/)
  assert.doesNotMatch(mk, /dãy số|trong thư/)
  // Người chưa từng đặt mật khẩu phải biết đường quay lại
  assert.match(mk, /bằng mã/)
  // Bối cảnh mặc định vẫn là OTP, không đổi hành vi của các chỗ gọi cũ
  assert.equal(dichLoiAuth({ code: 'invalid_credentials' }),
               dichLoiAuth({ code: 'invalid_credentials' }, 'otp'))
})

test('email chưa xác nhận: chỉ đúng chỗ tắc, không đổ cho mật khẩu', () => {
  const a = dichLoiAuth({ code: 'email_not_confirmed' }, 'matkhau')
  assert.match(a, /chưa xác nhận/)
  assert.match(a, /bằng mã/)
})

test('hết lượt gửi thư thì chỉ luôn lối thoát bằng mật khẩu', () => {
  assert.match(dichLoiAuth({ code: 'over_email_send_rate_limit' }), /mật khẩu/)
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
