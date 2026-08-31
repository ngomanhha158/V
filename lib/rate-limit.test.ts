import test from 'node:test'
import assert from 'node:assert/strict'
import { _reset, demLuot, ipClient, xoaLuot } from './rate-limit.ts'

test('cho qua tới đúng giới hạn rồi mới chặn', () => {
  _reset()
  for (let i = 0; i < 3; i++) {
    assert.equal(demLuot('a', 3, 60_000).chan, false, `lượt ${i + 1} phải qua`)
  }
  assert.equal(demLuot('a', 3, 60_000).chan, true)
})

test('mỗi khóa đếm riêng', () => {
  _reset()
  for (let i = 0; i < 3; i++) demLuot('a', 3, 60_000)
  assert.equal(demLuot('a', 3, 60_000).chan, true)
  assert.equal(demLuot('b', 3, 60_000).chan, false)
})

test('hết cửa sổ thì đếm lại từ đầu', () => {
  _reset()
  for (let i = 0; i < 3; i++) demLuot('a', 3, 1)
  assert.equal(demLuot('a', 3, 1).chan, true)
  const den = Date.now() + 5
  while (Date.now() < den) { /* đợi cửa sổ 1ms trôi qua */ }
  assert.equal(demLuot('a', 3, 1).chan, false)
})

test('xóa bộ đếm khi thành công', () => {
  _reset()
  for (let i = 0; i < 3; i++) demLuot('a', 3, 60_000)
  assert.equal(demLuot('a', 3, 60_000).chan, true)
  xoaLuot('a')
  assert.equal(demLuot('a', 3, 60_000).chan, false)
})

test('choMs nói còn phải đợi bao lâu', () => {
  _reset()
  demLuot('a', 1, 60_000)
  const r = demLuot('a', 1, 60_000)
  assert.equal(r.chan, true)
  assert.ok(r.choMs > 50_000 && r.choMs <= 60_000, `choMs = ${r.choMs}`)
})

const req = (h: Record<string, string>) => new Request('https://x.vn', { headers: h })

test('IP lấy phần tử CUỐI của x-forwarded-for, không phải phần tử đầu', () => {
  // Client tự bịa '1.2.3.4' ở đầu; proxy nối ip thật vào cuối. Lấy đầu là để
  // kẻ tấn công đổi "IP" mỗi request và đi vòng qua bộ đếm.
  assert.equal(ipClient(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })), '203.0.113.9')
  assert.equal(ipClient(req({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9')
})

test('không có x-forwarded-for thì lùi về x-real-ip rồi mới chịu thua', () => {
  assert.equal(ipClient(req({ 'x-real-ip': '198.51.100.7' })), '198.51.100.7')
  assert.equal(ipClient(req({})), 'khong-ro')
})
