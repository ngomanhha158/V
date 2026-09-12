import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { loiDoiChieu, nhanLoai, soDuTaiNgay, tienCoDau } from './quy.ts'

const HOM_NAY = new Date('2026-05-10T00:00:00Z')

test('tiền có dấu dùng dấu trừ thật, không phải gạch nối', () => {
  assert.equal(tienCoDau(18_420_000), '+18.420.000đ')
  // Gạch nối (U+002D) trong bảng đầy gạch nối trông như ô để trống.
  assert.equal(tienCoDau(-96_000_000), '−' + '96.000.000đ')
  assert.doesNotMatch(tienCoDau(-96_000_000), /-/)
  assert.equal(tienCoDau(0), '0đ')
})

test('chưa đối chiếu bao giờ thì nói thẳng là số dư chưa chứng minh được gì', () => {
  const r = loiDoiChieu({ dong: [{ ngay: '2026-01-01', luy_ke: 2_247_920_000 }], soNganHang: null, ngay: null, homNay: HOM_NAY })
  assert.equal(r.muc, 'canh')
  assert.match(r.than, /sổ tự cộng/)
})

test('lệch thì nói rõ hướng lệch và số tiền', () => {
  const r = loiDoiChieu({ dong: [{ ngay: '2026-05-09', luy_ke: 2_247_920_000 }], soNganHang: 2_151_920_000, ngay: '2026-05-09', homNay: HOM_NAY })
  assert.equal(r.muc, 'xau')
  assert.match(r.than, /nhiều hơn/)
  assert.match(r.than, /96\.000\.000đ/)
})

test('lệch ngược chiều thì đổi chữ, không đổi dấu số', () => {
  const r = loiDoiChieu({ dong: [{ ngay: '2026-05-09', luy_ke: 100_000 }], soNganHang: 500_000, ngay: '2026-05-09', homNay: HOM_NAY })
  assert.match(r.than, /ít hơn/)
  // Số tiền lệch luôn dương: "ít hơn −400.000đ" là câu không đọc được.
  assert.match(r.than, /400\.000đ/)
  assert.doesNotMatch(r.than, /[-−]400/)
})

test('khớp và mới thì xanh', () => {
  const r = loiDoiChieu({ dong: [{ ngay: '2026-05-09', luy_ke: 5_000 }], soNganHang: 5_000, ngay: '2026-05-09', homNay: HOM_NAY })
  assert.equal(r.muc, 'tot')
  assert.match(r.than, /1 ngày trước/)
})

test('khớp nhưng số liệu đã cũ vẫn là cảnh báo', () => {
  // Khớp hồi tháng 1 không nói gì về tháng 5. Để nó xanh là dạy người đọc tin
  // vào một con số đã hết hạn.
  const r = loiDoiChieu({ dong: [{ ngay: '2026-01-05', luy_ke: 5_000 }], soNganHang: 5_000, ngay: '2026-01-05', homNay: HOM_NAY })
  assert.equal(r.muc, 'canh')
  assert.match(r.tieu, /125 ngày/)
})

test('đối chiếu hôm nay đọc là "hôm nay", không phải "0 ngày trước"', () => {
  const r = loiDoiChieu({ dong: [{ ngay: '2026-05-10', luy_ke: 5_000 }], soNganHang: 5_000, ngay: '2026-05-10', homNay: HOM_NAY })
  assert.match(r.than, /hôm nay/)
  assert.doesNotMatch(r.than, /0 ngày/)
})

test('nhãn loại giao dịch', () => {
  assert.equal(nhanLoai('so_du_dau'), 'Số dư đầu kỳ')
  assert.equal(nhanLoai('lai'), 'Lãi ngân hàng')
  assert.equal(nhanLoai('linh_tinh'), 'linh_tinh')
})

test('KHÔNG báo lệch chỉ vì quỹ có chi tiêu SAU ngày đối chiếu', () => {
  // Đây là lỗi mà bản trước của hàm này mắc phải, và nó là lỗi tệ theo đúng
  // kiểu tệ nhất: cảnh báo to nhất trên màn quỹ bắn SAI, ở đúng tình huống
  // bình thường nhất — quỹ chi một khoản. Bắn sai vài lần là người đọc thôi
  // không nhìn nữa, và lần lệch thật cũng trôi qua.
  //
  // 31/03 sao kê 2.151.920.000 khớp sổ. 10/04 chi 96 triệu. Hôm nay 15/04.
  // So sổ HÔM NAY với sao kê 31/03 sẽ ra "lệch 96 triệu" — không có thật.
  const dong = [
    { ngay: '2026-03-31', luy_ke: 2_151_920_000 },
    { ngay: '2026-04-10', luy_ke: 2_055_920_000 },
  ]
  const r = loiDoiChieu({
    dong, soNganHang: 2_151_920_000, ngay: '2026-03-31',
    homNay: new Date('2026-04-15T00:00:00Z'),
  })
  assert.equal(r.muc, 'tot', 'khớp tại ngày đối chiếu thì không được báo lệch')
  assert.doesNotMatch(r.tieu, /KHÔNG KHỚP/)
})

test('lệch THẬT tại ngày đối chiếu vẫn bị bắt, kể cả khi sổ đã đi tiếp', () => {
  // Nửa còn lại: sửa cái trên mà làm mất luôn khả năng bắt lệch thì tệ hơn.
  const dong = [
    { ngay: '2026-03-31', luy_ke: 2_100_000_000 },
    { ngay: '2026-04-10', luy_ke: 2_004_000_000 },
  ]
  const r = loiDoiChieu({
    dong, soNganHang: 2_151_920_000, ngay: '2026-03-31',
    homNay: new Date('2026-04-15T00:00:00Z'),
  })
  assert.equal(r.muc, 'xau')
  assert.match(r.than, /ít hơn/)
  assert.match(r.than, /51\.920\.000đ/)
})

test('số dư tại một ngày lấy dòng cuối cùng KHÔNG vượt mốc', () => {
  const dong = [
    { ngay: '2026-01-10', luy_ke: 500 },
    { ngay: '2026-03-31', luy_ke: 620 },
  ]
  assert.equal(soDuTaiNgay(dong, '2026-01-09'), 0, 'trước dòng đầu thì sổ chưa có gì')
  assert.equal(soDuTaiNgay(dong, '2026-01-10'), 500, 'đúng ngày đó thì tính vào')
  assert.equal(soDuTaiNgay(dong, '2026-12-31'), 620)
  assert.equal(soDuTaiNgay([], '2026-05-20'), 0)
})
