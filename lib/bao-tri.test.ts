import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hanKeTiep, HANG_MUC, soNgayToi, tenChuKy, tenHangMuc, theoHan, tinhTrangHan } from './bao-tri.ts'

const NGAY = (s: string) => new Date(`${s}T09:00:00Z`)

test('hạng mục bắt buộc theo luật được đánh dấu đúng', () => {
  assert.equal(HANG_MUC.thang_may.luat, true)
  assert.equal(HANG_MUC.pccc.luat, true)
  assert.equal(HANG_MUC.ve_sinh.luat, false)
  assert.equal(tenHangMuc('thang_may'), 'Thang máy')
  assert.equal(tenHangMuc('hang_muc_moi'), 'hang_muc_moi')
})

test('chu kỳ lạ vẫn đọc được, không rơi ra rỗng', () => {
  assert.equal(tenChuKy(90), 'Hằng quý')
  assert.equal(tenChuKy(45), '45 ngày một lần')
})

test('đếm ngày theo lịch, không theo 24 giờ tròn', () => {
  // Đếm theo mili-giây thì hạn hôm nay lúc 23h so với bây giờ 9h ra 0 ngày,
  // nhưng cùng phép tính đó qua nửa đêm lại ra âm — hạn nhảy màu tùy giờ mở màn.
  assert.equal(soNgayToi('2026-09-10', NGAY('2026-09-02')), 8)
  assert.equal(soNgayToi('2026-09-02', NGAY('2026-09-02')), 0)
  assert.equal(soNgayToi('2026-08-29', NGAY('2026-09-02')), -4)
})

test('quá hạn nói rõ quá bao nhiêu ngày, không chỉ nói "quá hạn"', () => {
  const t = tinhTrangHan('2026-08-29', 7, true, NGAY('2026-09-02'))
  assert.equal(t.muc, 'qua_han')
  assert.equal(t.tone, 'xau')
  assert.equal(t.nhan, 'quá 4 ngày')
})

test('đến hạn hôm nay là mức đỏ, không phải vàng', () => {
  // Hôm nay là ngày cuối cùng còn kịp. Để vàng như "còn 6 ngày" thì nó trôi qua
  // trong đống việc thường ngày.
  const t = tinhTrangHan('2026-09-02', 7, false, NGAY('2026-09-02'))
  assert.equal(t.tone, 'xau')
  assert.equal(t.nhan, 'đến hạn hôm nay')
})

test('trong cửa sổ nhắc thì vàng, ngoài thì xanh', () => {
  assert.equal(tinhTrangHan('2026-09-08', 7, false, NGAY('2026-09-02')).tone, 'canh')
  assert.equal(tinhTrangHan('2026-09-30', 7, false, NGAY('2026-09-02')).tone, 'tot')
})

test('hạng mục bắt buộc theo luật KHÔNG bao giờ xuống mức xanh', () => {
  // Quá hạn kiểm định thang máy là bị phạt và mất an toàn. Để nó cùng màu với
  // một việc vệ sinh cùng ngày là làm hai loại rủi ro rất khác nhau trông giống
  // nhau — mà cái nặng hơn lại là cái dễ trôi qua.
  const luat = tinhTrangHan('2026-12-30', 7, true, NGAY('2026-09-02'))
  const thuong = tinhTrangHan('2026-12-30', 7, false, NGAY('2026-09-02'))
  assert.equal(luat.muc, 'con_xa')
  assert.equal(thuong.muc, 'con_xa')
  assert.notEqual(luat.tone, thuong.tone)
  assert.equal(luat.tone, 'canh')
  assert.equal(thuong.tone, 'tot')
})

test('sắp xếp đẩy việc gấp nhất lên đầu', () => {
  const ds = [
    { han_ke_tiep: '2026-12-01' },
    { han_ke_tiep: '2026-08-20' },
    { han_ke_tiep: '2026-09-05' },
  ]
  assert.deepEqual(
    [...ds].sort(theoHan).map((x) => x.han_ke_tiep),
    ['2026-08-20', '2026-09-05', '2026-12-01'],
  )
})

test('hạn kế tiếp tính từ hôm nay, khớp với hàm SQL', () => {
  // SQL dùng current_date + chu_ky_ngay. Màn xem trước phải ra đúng con số đó,
  // nếu không người dùng thấy một hạn rồi lưu xong lại thành hạn khác.
  assert.equal(hanKeTiep(365, NGAY('2026-09-02')), '2027-09-02')
  assert.equal(hanKeTiep(90, NGAY('2026-09-02')), '2026-12-01')
})
