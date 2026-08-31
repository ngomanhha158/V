import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crc16ccitt, buildVietQr, paymentRef } from './vietqr.ts'

test('CRC đúng biến thể CCITT-FALSE (vector chuẩn)', () => {
  // Có ít nhất 4 biến thể CRC-16 dùng chung poly 0x1021. Vector này chốt đúng cái cần.
  assert.equal(crc16ccitt('123456789'), '29B1')
  assert.equal(crc16ccitt(''), 'FFFF')
})

test('payload bắt đầu và kết thúc đúng chuẩn', () => {
  const p = buildVietQr({ bin: '970436', accountNumber: '1234567890', amount: 2845500 })
  assert.ok(p.startsWith('000201'))          // format indicator = 01
  assert.match(p, /6304[0-9A-F]{4}$/)        // CRC 4 hex ở cuối
})

test('CRC trong payload tự kiểm chứng được', () => {
  const p = buildVietQr({ bin: '970436', accountNumber: '1234567890', amount: 1000 })
  const body = p.slice(0, -4)                // gồm cả "6304"
  assert.equal(crc16ccitt(body), p.slice(-4))
})

test('QR động khi có số tiền, tĩnh khi không', () => {
  // So NGUYÊN trường 01 (4 ký tự giá trị), không chỉ tiền tố: '00020101021' là
  // phần CHUNG của cả hai, so tới đó thì test không phân biệt được gì.
  const dong = buildVietQr({ bin: '970436', accountNumber: '1234567890', amount: 1000 })
  const tinh = buildVietQr({ bin: '970436', accountNumber: '1234567890' })
  assert.ok(dong.startsWith('000201' + '010212'), 'QR có số tiền phải là động (12)')
  assert.ok(tinh.startsWith('000201' + '010211'), 'QR không số tiền phải là tĩnh (11)')
  assert.ok(!tinh.includes('5406'))          // không có trường số tiền
})

test('chuyển tới TÀI KHOẢN, không phải thẻ', () => {
  // QRIBFTTA = to account, QRIBFTTC = to card. Nhầm một chữ cái là tiền đi sai
  // chỗ mà payload vẫn hợp lệ, quét vẫn ra QR đẹp.
  const p = buildVietQr({ bin: '970436', accountNumber: '1234567890', amount: 1000 })
  assert.ok(p.includes('0208QRIBFTTA'))
  assert.ok(!p.includes('QRIBFTTC'))
})

test('BIN và số tài khoản vào đúng trường lồng trong 38', () => {
  const p = buildVietQr({ bin: '970436', accountNumber: '1234567890', amount: 1000 })
  assert.ok(p.includes('0006970436'))        // 00 + độ dài 06 + BIN
  assert.ok(p.includes('01101234567890'))    // 01 + độ dài 10 + số TK
})

test('số tiền vào đúng trường 54 với độ dài đúng', () => {
  const p = buildVietQr({ bin: '970436', accountNumber: '1234567890', amount: 2845500 })
  assert.ok(p.includes('54072845500'))       // 54 + độ dài 07 + giá trị
})

test('nội dung chuyển khoản nằm trong 62-08', () => {
  const p = buildVietQr({
    bin: '970436', accountNumber: '1234567890', amount: 1000,
    description: 'VB P1-10.01 202608',
  })
  assert.ok(p.includes('0818VB P1-10.01 202608'))
})

test('từ chối tham số sai thay vì sinh QR hỏng', () => {
  assert.throws(() => buildVietQr({ bin: '97043', accountNumber: '1234567890' }), /BIN/)
  assert.throws(() => buildVietQr({ bin: '970436', accountNumber: 'abc' }), /tai khoan/)
  assert.throws(() => buildVietQr({ bin: '970436', accountNumber: '1234567890', amount: 0 }), /so nguyen duong/)
  assert.throws(() => buildVietQr({ bin: '970436', accountNumber: '1234567890', amount: 1.5 }), /so nguyen duong/)
})

test('nội dung chuyển khoản: bỏ dấu, giữ dạng máy đọc lại được', () => {
  assert.equal(paymentRef('P1-10.01', '2026-08-01'), 'VB P1-10.01 202608')
  assert.equal(paymentRef('p1-10.01', '2026-08-01'), 'VB P1-10.01 202608')
  // Ký tự lạ bị loại để ngân hàng không tự cắt mất
  assert.equal(paymentRef('P1/10#01', '2026-12-01'), 'VB P11001 202612')
})
