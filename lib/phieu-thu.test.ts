import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { hinhThuc, loiHuy, loiLienTuc, soPhieu, tongDong } from './phieu-thu.ts'

test('số chứng từ ghép đúng dạng PT-YYMM-NNNN', () => {
  assert.equal(soPhieu('2026-09-01', 184), 'PT-2609-0184')
  assert.equal(soPhieu('2026-09-01', 1), 'PT-2609-0001')
  // Vượt 4 chữ số thì KHÔNG được cắt bớt: cắt là hai phiếu trùng số.
  assert.equal(soPhieu('2026-12-01', 12345), 'PT-2612-12345')
})

test('dãy liền mạch nói ra khoảng số, không chỉ nói "ổn"', () => {
  const r = loiLienTuc('2026-09-01', [], 184)
  assert.equal(r.ok, true)
  assert.match(r.loi, /PT-2609-0001/)
  assert.match(r.loi, /PT-2609-0184/)
})

test('dãy thủng thì gọi tên số chứng từ, không phải số thứ tự trần', () => {
  const r = loiLienTuc('2026-09-01', [137, 142], 184)
  assert.equal(r.ok, false)
  assert.match(r.loi, /PT-2609-0137/)
  assert.match(r.loi, /PT-2609-0142/)
  // Không được để lọt số trần ra ngoài: "thiếu 137" thì người đọc phải tự ghép
  // lại mới tra được, mà tra chính là việc họ đang làm.
  assert.doesNotMatch(r.loi, /:\s*137/)
  // Và phải nói VIỆC PHẢI LÀM, không chỉ nói là hỏng. Người mở trang này lúc
  // nó đỏ là người chưa từng thấy nó đỏ bao giờ.
  assert.match(r.loi, /nhật ký kiểm toán/)
})

test('thủng nhiều thì không xổ hết ra màn hình', () => {
  const r = loiLienTuc('2026-09-01', [1, 2, 3, 4, 5, 6, 7], 184)
  assert.match(r.loi, /và 2 số nữa/)
  assert.match(r.loi, /Thiếu 7 số/)
})

test('kỳ chưa có phiếu nào không bị báo là thủng', () => {
  assert.equal(loiLienTuc('2026-09-01', [], 0).ok, true)
})

test('tổng phiếu KHÔNG cộng dòng chi tiết phí', () => {
  const dong = [
    { loai: 'hoa_don' as const, so_tien: 1406000 },
    { loai: 'chi_tiet' as const, so_tien: 1287000 },
    { loai: 'chi_tiet' as const, so_tien: 119000 },
  ]
  // Cộng cả chi tiết ra 2.812.000 — gấp đôi, và đúng bằng lỗi mà người đọc
  // sẽ tưởng là hệ thống thu hai lần.
  assert.equal(tongDong(dong), 1406000)
})

test('tổng phiếu cộng cả phần nộp trước', () => {
  assert.equal(
    tongDong([
      { loai: 'hoa_don', so_tien: 500000 },
      { loai: 'nop_truoc', so_tien: 300000 },
    ]),
    800000,
  )
})

test('phiếu hủy nói rõ tiền không mất', () => {
  const r = loiHuy('Ghi nhầm căn')
  assert.match(r.than, /Ghi nhầm căn/)
  assert.match(r.than, /Tiền vẫn đã ghi nhận/)
})

test('phiếu hủy không ghi lý do vẫn phải đọc được', () => {
  assert.match(loiHuy(null).than, /không ghi/)
  assert.match(loiHuy('   ').than, /không ghi/)
})

test('nhãn hình thức', () => {
  assert.equal(hinhThuc('chuyen_khoan'), 'Chuyển khoản')
  assert.equal(hinhThuc('tien_mat'), 'Tiền mặt')
  // Giá trị lạ thì hiện nguyên văn, không nuốt mất.
  assert.equal(hinhThuc('vi_dien_tu'), 'vi_dien_tu')
})
