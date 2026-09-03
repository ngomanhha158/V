import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { loiDoiChieu, nhanLoai, tienCoDau } from './quy.ts'

const HOM_NAY = new Date('2026-05-10T00:00:00Z')

test('tiền có dấu dùng dấu trừ thật, không phải gạch nối', () => {
  assert.equal(tienCoDau(18_420_000), '+18.420.000đ')
  // Gạch nối (U+002D) trong bảng đầy gạch nối trông như ô để trống.
  assert.equal(tienCoDau(-96_000_000), '−' + '96.000.000đ')
  assert.doesNotMatch(tienCoDau(-96_000_000), /-/)
  assert.equal(tienCoDau(0), '0đ')
})

test('chưa đối chiếu bao giờ thì nói thẳng là số dư chưa chứng minh được gì', () => {
  const r = loiDoiChieu({ soSach: 2_247_920_000, soNganHang: null, ngay: null, homNay: HOM_NAY })
  assert.equal(r.muc, 'canh')
  assert.match(r.than, /sổ tự cộng/)
})

test('lệch thì nói rõ hướng lệch và số tiền', () => {
  const r = loiDoiChieu({ soSach: 2_247_920_000, soNganHang: 2_151_920_000, ngay: '2026-05-09', homNay: HOM_NAY })
  assert.equal(r.muc, 'xau')
  assert.match(r.than, /nhiều hơn/)
  assert.match(r.than, /96\.000\.000đ/)
})

test('lệch ngược chiều thì đổi chữ, không đổi dấu số', () => {
  const r = loiDoiChieu({ soSach: 100_000, soNganHang: 500_000, ngay: '2026-05-09', homNay: HOM_NAY })
  assert.match(r.than, /ít hơn/)
  // Số tiền lệch luôn dương: "ít hơn −400.000đ" là câu không đọc được.
  assert.match(r.than, /400\.000đ/)
  assert.doesNotMatch(r.than, /[-−]400/)
})

test('khớp và mới thì xanh', () => {
  const r = loiDoiChieu({ soSach: 5_000, soNganHang: 5_000, ngay: '2026-05-09', homNay: HOM_NAY })
  assert.equal(r.muc, 'tot')
  assert.match(r.than, /1 ngày trước/)
})

test('khớp nhưng số liệu đã cũ vẫn là cảnh báo', () => {
  // Khớp hồi tháng 1 không nói gì về tháng 5. Để nó xanh là dạy người đọc tin
  // vào một con số đã hết hạn.
  const r = loiDoiChieu({ soSach: 5_000, soNganHang: 5_000, ngay: '2026-01-05', homNay: HOM_NAY })
  assert.equal(r.muc, 'canh')
  assert.match(r.tieu, /125 ngày/)
})

test('đối chiếu hôm nay đọc là "hôm nay", không phải "0 ngày trước"', () => {
  const r = loiDoiChieu({ soSach: 5_000, soNganHang: 5_000, ngay: '2026-05-10', homNay: HOM_NAY })
  assert.match(r.than, /hôm nay/)
  assert.doesNotMatch(r.than, /0 ngày/)
})

test('nhãn loại giao dịch', () => {
  assert.equal(nhanLoai('so_du_dau'), 'Số dư đầu kỳ')
  assert.equal(nhanLoai('lai'), 'Lãi ngân hàng')
  assert.equal(nhanLoai('linh_tinh'), 'linh_tinh')
})
