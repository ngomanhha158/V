import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conTrong, docConTrong, docHanMuc, loiChoDoi, LOAI_XE, NHAN_LOAI, NHAN_TRANG_THAI, nhanLoai, vuotSucChua } from './xe.ts'

test('mọi loại xe trong enum đều có nhãn tiếng Việt', () => {
  for (const l of LOAI_XE) assert.ok(NHAN_LOAI[l], `thiếu nhãn cho ${l}`)
})

test('loại lạ thì hiện nguyên văn, không thành trống', () => {
  assert.equal(nhanLoai('xe_tai'), 'xe_tai')
  assert.equal(nhanLoai(null), '—')
})

test('ba trạng thái đều có nhãn, và không cái nào trùng cái nào', () => {
  const n = ['da_duyet', 'hang_cho', 'qua_han_muc'].map((t) => NHAN_TRANG_THAI[t])
  assert.ok(n.every(Boolean))
  assert.equal(new Set(n).size, 3)
})

test('CHỜ HẦM và VƯỢT HẠN MỨC phải nói hai câu khác hẳn nhau', () => {
  // Đây là cả lý do tách hai trạng thái. Người đợi hầm trống thì cứ đợi; người
  // vượt hạn mức đợi mãi cũng không tới lượt — nói chung một câu là để một nửa
  // số người chờ vô ích.
  const cho = loiChoDoi('hang_cho', 3)
  const vuot = loiChoDoi('qua_han_muc', 0)
  assert.notEqual(cho, vuot)
  assert.match(cho, /vị trí 3/)
  assert.match(vuot, /ban quản lý|hạn mức/)
  assert.doesNotMatch(vuot, /vị trí/)
})

test('đang xếp hàng mà chưa biết vị trí thì không bịa ra số', () => {
  assert.doesNotMatch(loiChoDoi('hang_cho', 0), /vị trí/)
})

test('tòa chưa đặt hạn mức thì nói ra, không hiện "2 / 0"', () => {
  // "2 / 0" đọc như đang vượt hạn mức, mà thật ra là BQL chưa điền gì.
  assert.equal(docHanMuc(2, 3, true), '2 / 3')
  assert.match(docHanMuc(2, 0, false), /chưa đặt hạn mức/)
  assert.doesNotMatch(docHanMuc(2, 0, false), /\/ 0/)
})

test('chỗ trống không bao giờ hiện số âm', () => {
  assert.equal(conTrong(10, 4), 6)
  assert.equal(conTrong(10, 12), 0)
})

test('không viết "còn 0/2" — người đọc không biết 0 là số nào', () => {
  // Đoán sai theo hướng nào cũng dẫn tới một cuộc gọi cho ban quản lý.
  assert.match(docConTrong(2, 2), /đầy/)
  assert.doesNotMatch(docConTrong(2, 2), /0\s*\//)
  assert.match(docConTrong(40, 0), /còn 40 chỗ/)
})

test('nhưng nhận quá sức chứa thì phải nhận ra được', () => {
  // Xảy ra thật khi BQL siết tong_cho xuống dưới số xe đang dùng. Hiện 0 chỗ
  // trống mà không cảnh báo thì không ai biết hầm đang quá tải.
  assert.equal(vuotSucChua(10, 12), true)
  assert.equal(vuotSucChua(10, 10), false)
})
