import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bangNhau } from './bi-mat.ts'

test('bằng nhau thì đúng, khác nhau thì sai', () => {
  assert.equal(bangNhau('abc123', 'abc123'), true)
  assert.equal(bangNhau('abc123', 'abc124'), false)
})

test('khác độ dài không làm văng, chỉ là không bằng', () => {
  // timingSafeEqual của Node ném lỗi khi hai buffer khác độ dài. Ném lỗi ở
  // đường xử lý webhook nghĩa là trả 500, mà 500 khác 401 — chính nó nói cho
  // kẻ dò biết độ dài khóa thật.
  assert.equal(bangNhau('abc', 'abcdef'), false)
  assert.equal(bangNhau('abcdef', 'abc'), false)
})

test('chuỗi rỗng không bằng chuỗi có nội dung', () => {
  // Trường hợp thật: biến môi trường quên đặt. Cho qua ở đây là mở toang.
  assert.equal(bangNhau('', 'bi-mat'), false)
  assert.equal(bangNhau('bi-mat', ''), false)
  assert.equal(bangNhau('', ''), true)
})

test('so theo byte, không theo ký tự', () => {
  // Hai chuỗi khác nhau nhưng cùng số ký tự Unicode vẫn phải khác nhau.
  assert.equal(bangNhau('khóa', 'khoá'), false)
  assert.equal(bangNhau('khóa', 'khóa'), true)
})
