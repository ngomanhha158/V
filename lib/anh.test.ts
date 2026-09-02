import { test } from 'node:test'
import assert from 'node:assert/strict'
import { duongMoi, hopLeDuong, kieuTheoDuong } from './anh.ts'

const CAN = '11111111-2222-3333-4444-555555555555'

test('đường do máy chủ sinh ra thì luôn hợp lệ', () => {
  for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
    const d = duongMoi(CAN, mime)
    assert.ok(hopLeDuong(d), `${mime} -> ${d}`)
  }
})

test('mỗi lần sinh ra một tên khác', () => {
  // Trùng tên là ảnh của yêu cầu này đè lên ảnh của yêu cầu khác.
  const n = new Set(Array.from({ length: 200 }, () => duongMoi(CAN, 'image/jpeg')))
  assert.equal(n.size, 200)
})

test('leo thư mục bị chặn', () => {
  // Đây là chốt duy nhất đứng giữa một request GET và toàn bộ đĩa của máy chủ.
  const xau = [
    `${CAN}/../../../etc/passwd`,
    `../${CAN}/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg`,
    `${CAN}/..%2fbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg`,
    `${CAN}/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg/../../x`,
    '/etc/passwd',
    `${CAN}//aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg`,
    `${CAN}/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg\0.txt`,
  ]
  for (const d of xau) assert.equal(hopLeDuong(d), false, `lọt: ${d}`)
})

test('đuôi lạ bị chặn, kể cả khi phần còn lại đúng khuôn', () => {
  const ten = 'a'.repeat(32)
  for (const duoi of ['svg', 'html', 'js', 'php', 'JPG', '']) {
    assert.equal(hopLeDuong(`${CAN}/${ten}.${duoi}`), false, `lọt đuôi ${duoi}`)
  }
  assert.equal(hopLeDuong(`${CAN}/${ten}.jpg`), true)
})

test('căn hộ phải là uuid, không phải chuỗi bất kỳ', () => {
  const ten = 'a'.repeat(32)
  // uuid có CHỮ trong đó, không phải toàn số: CAN ở trên viết hoa lên vẫn là
  // chính nó, nên dùng nó để kiểm chữ hoa là kiểm một chuỗi không đổi.
  const co_chu = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
  assert.equal(hopLeDuong(`${co_chu}/${ten}.jpg`), true)
  assert.equal(hopLeDuong(`${co_chu.toUpperCase()}/${ten}.jpg`), false)
  assert.equal(hopLeDuong(`chung/${ten}.jpg`), false)
  assert.equal(hopLeDuong(`${ten}.jpg`), false)
})

test('kiểu trả về khớp đuôi, mặc định là jpeg', () => {
  const ten = 'a'.repeat(32)
  assert.equal(kieuTheoDuong(`${CAN}/${ten}.png`), 'image/png')
  assert.equal(kieuTheoDuong(`${CAN}/${ten}.webp`), 'image/webp')
  assert.equal(kieuTheoDuong(`${CAN}/${ten}.jpg`), 'image/jpeg')
})
