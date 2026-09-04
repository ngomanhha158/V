import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { NHAN_TRANG_THAI, loiHieuLuc, loiLechQuy, loiTyLeNo, trangThaiChot } from './ban-giao.ts'

const c = (p: Partial<{ huy_luc: string | null; ky_bql_luc: string | null; ky_bqt_luc: string | null }>) =>
  ({ huy_luc: null, ky_bql_luc: null, ky_bqt_luc: null, ...p })

test('trạng thái suy ra đủ năm ca', () => {
  assert.equal(trangThaiChot(c({})), 'cho_ca_hai')
  assert.equal(trangThaiChot(c({ ky_bql_luc: 'x' })), 'cho_bqt')
  assert.equal(trangThaiChot(c({ ky_bqt_luc: 'x' })), 'cho_bql')
  assert.equal(trangThaiChot(c({ ky_bql_luc: 'x', ky_bqt_luc: 'y' })), 'da_ky')
  // Hủy thắng tất cả: một bản đã hủy mà hiện "hai bên đã ký" là mời người ta
  // dùng số liệu không còn giá trị.
  assert.equal(trangThaiChot(c({ huy_luc: 'z', ky_bql_luc: 'x', ky_bqt_luc: 'y' })), 'da_huy')
})

test('chờ ký thì nói RÕ CÒN THIẾU AI', () => {
  // "Chưa ký" trống không thì người đọc không biết đi gọi ai.
  assert.match(loiHieuLuc('cho_bqt').tieu, /ban quản trị/i)
  assert.match(loiHieuLuc('cho_bql').tieu, /ban quản lý/i)
  assert.notEqual(NHAN_TRANG_THAI.cho_bqt, NHAN_TRANG_THAI.cho_bql)
})

test('chỉ bản hai bên đã ký mới là "có hiệu lực"', () => {
  assert.equal(loiHieuLuc('da_ky').ok, true)
  for (const t of ['cho_bql', 'cho_bqt', 'cho_ca_hai', 'da_huy'] as const) {
    assert.equal(loiHieuLuc(t).ok, false, t)
  }
})

test('bản chưa ai ký nói rõ đây mới là số liệu, chưa phải thỏa thuận', () => {
  const r = loiHieuLuc('cho_ca_hai')
  assert.match(r.than, /chưa phải thỏa thuận/)
  // Và chỉ ra lối đi khi thấy sai: lập bản mới, không sửa bản này.
  assert.match(r.than, /không sửa bản này/)
})

test('bản đã hủy nói lý do và cấm dùng số liệu', () => {
  const r = loiHieuLuc('da_huy', 'Chốt nhầm ngày')
  assert.match(r.than, /Chốt nhầm ngày/)
  assert.match(r.than, /Đừng dùng số liệu/)
  assert.match(loiHieuLuc('da_huy', null).than, /không ghi/)
})

test('tỷ lệ nợ viết bằng phần trăm, không bắt người đọc tự chia', () => {
  const r = loiTyLeNo(37, 468)
  assert.match(r.loi, /37 trên 468/)
  assert.match(r.loi, /7,9%/)
  assert.equal(r.muc, 'tot')
})

test('tỷ lệ nợ cao thì đổi mức VÀ nói ra việc phải làm', () => {
  const r = loiTyLeNo(200, 468)
  assert.equal(r.muc, 'xau')
  assert.match(r.loi, /trước khi hai bên ký/)
  assert.equal(loiTyLeNo(60, 468).muc, 'canh')
})

test('chưa có căn nào thì không chia cho 0', () => {
  assert.equal(loiTyLeNo(0, 0).muc, 'trung')
})

test('chưa đối chiếu ngân hàng là một vấn đề, không phải im lặng', () => {
  const r = loiLechQuy(2_106_920_000, null)
  assert.equal(r.ok, false)
  assert.match(r.loi, /sổ tự nói sổ đúng/)
})

test('lệch quỹ nói hướng lệch, số luôn dương, và nói vì sao phải sửa TRƯỚC khi ký', () => {
  const r = loiLechQuy(2_106_920_000, 2_100_000_000)
  assert.equal(r.ok, false)
  assert.match(r.loi, /nhiều hơn/)
  assert.match(r.loi, /6\.920\.000đ/)
  assert.doesNotMatch(r.loi, /[-−]6\.920/)
  assert.match(r.loi, /trước khi ký/)
  assert.match(loiLechQuy(100, 500).loi, /ít hơn/)
})

test('quỹ khớp thì nói khớp', () => {
  assert.equal(loiLechQuy(500, 500).ok, true)
})
