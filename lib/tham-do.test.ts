import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demTheoLuaChon, NHAN_TRANG_THAI, phanTram, tongPhieu, trangThai } from './tham-do.ts'

const tong = (a: number[]) => a.reduce((s, n) => s + n, 0)

test('phần trăm luôn cộng đúng 100', () => {
  // Làm tròn từng phần riêng lẻ thì 1/3 ba lần ra 99, và người đọc thấy bảng
  // thiếu 1% — trông như đếm sót phiếu. Mất niềm tin vào con số là mất cả cuộc
  // thăm dò.
  for (const p of [[1, 1, 1], [148, 61], [1, 2, 3, 4], [7, 7, 7, 7, 7, 7, 7], [1, 0, 0]]) {
    assert.equal(tong(phanTram(p)), 100, `bộ ${p} ra ${phanTram(p)}`)
  }
})

test('một phần ba ba lần ra 34/33/33 chứ không phải 33/33/33', () => {
  assert.deepEqual(phanTram([1, 1, 1]), [34, 33, 33])
})

test('phần dư bằng nhau thì ưu tiên lựa chọn đứng trước, kết quả ổn định', () => {
  // Cùng một bộ phiếu phải luôn ra cùng một bảng, không nhảy mỗi lần tải lại.
  const a = phanTram([1, 1, 1])
  const b = phanTram([1, 1, 1])
  assert.deepEqual(a, b)
})

test('chưa ai bỏ phiếu thì tất cả là 0, không chia cho 0', () => {
  assert.deepEqual(phanTram([0, 0]), [0, 0])
  assert.deepEqual(phanTram([]), [])
})

test('tỉ lệ thường gặp ra đúng số', () => {
  assert.deepEqual(phanTram([148, 61]), [71, 29])
  assert.deepEqual(phanTram([3, 1]), [75, 25])
})

test('lựa chọn chưa ai chọn vẫn có chỗ trong bảng', () => {
  // Bỏ hẳn dòng "0 phiếu" thì bảng kết quả thiếu lựa chọn, và người đọc tưởng
  // nó chưa bao giờ được đưa ra.
  assert.deepEqual(demTheoLuaChon([{ chon: 0, so_phieu: 5 }], 3), [5, 0, 0])
  assert.equal(tongPhieu(demTheoLuaChon([{ chon: 1, so_phieu: 2 }], 2)), 2)
})

test('phiếu trỏ vào lựa chọn không còn tồn tại thì bỏ qua, không gộp', () => {
  // BQL xóa bớt một lựa chọn sau khi đã có phiếu. Gộp số đó vào lựa chọn khác
  // là bịa ra một con số không ai bỏ.
  const r = demTheoLuaChon([{ chon: 0, so_phieu: 4 }, { chon: 9, so_phieu: 3 }], 2)
  assert.deepEqual(r, [4, 0])
  assert.equal(tongPhieu(r), 4)
})

test('đóng rồi thì ai cũng xem được, kể cả cuộc kín', () => {
  const truoc = new Date('2026-09-01T00:00:00Z').toISOString()
  const bay = new Date('2026-09-02T00:00:00Z')
  assert.equal(trangThai(true, truoc, bay), 'da_dong')
  assert.equal(trangThai(false, truoc, bay), 'da_dong')
})

test('cuộc kín chưa đóng khác hẳn cuộc mở chưa đóng', () => {
  const sau = new Date('2026-12-01T00:00:00Z').toISOString()
  const bay = new Date('2026-09-02T00:00:00Z')
  assert.equal(trangThai(true, sau, bay), 'kin_chua_dong')
  assert.equal(trangThai(false, sau, bay), 'dang_mo')
  assert.equal(trangThai(false, null, bay), 'dang_mo')
  assert.notEqual(NHAN_TRANG_THAI.kin_chua_dong, NHAN_TRANG_THAI.dang_mo)
})
