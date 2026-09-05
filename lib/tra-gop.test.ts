import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  NHAN_CACH_CHIA, NHAN_DOT, TONE_DOT,
  cacKy, ganhNang, gomTheoKeHoach, kyVN, loiDot, moiKy, trangThaiDot,
  type Dot,
} from './tra-gop.ts'

const d = (p: Partial<Dot>): Dot => ({
  thu_tu: 1, ky: '2026-10-01', so_tien: 111_111,
  hoa_don_id: null, hoa_don_trang_thai: null,
  hoa_don_tong: null, hoa_don_da_tra: null, huy_luc: null, ...p,
})

test('trạng thái đợt bám vào HÓA ĐƠN, không giả vờ biết từng dòng', () => {
  assert.equal(trangThaiDot(d({})), 'chua_len_hoa_don')
  assert.equal(trangThaiDot(d({ hoa_don_id: 'x', hoa_don_trang_thai: 'draft' })), 'tren_hoa_don_nhap')
  assert.equal(
    trangThaiDot(d({ hoa_don_id: 'x', hoa_don_trang_thai: 'issued', hoa_don_tong: 500_000, hoa_don_da_tra: 200_000 })),
    'con_thieu',
  )
  assert.equal(
    trangThaiDot(d({ hoa_don_id: 'x', hoa_don_trang_thai: 'paid', hoa_don_tong: 500_000, hoa_don_da_tra: 500_000 })),
    'da_tra',
  )
  // Trả DƯ vẫn là đã trả đủ, không phải "còn thiếu -50.000đ".
  assert.equal(
    trangThaiDot(d({ hoa_don_id: 'x', hoa_don_trang_thai: 'paid', hoa_don_tong: 500_000, hoa_don_da_tra: 550_000 })),
    'da_tra',
  )
  // Hủy thắng tất cả: một đợt đã dừng thu mà hiện "còn thiếu" là đòi tiền không
  // còn ai phải trả.
  assert.equal(
    trangThaiDot(d({ huy_luc: 'z', hoa_don_id: 'x', hoa_don_trang_thai: 'issued', hoa_don_tong: 5, hoa_don_da_tra: 0 })),
    'da_huy',
  )
})

test('hóa đơn NHÁP không được tính là đã đòi tiền', () => {
  // generate_invoices dựng lại hóa đơn nháp từ đầu mỗi lần chạy, nên nó chưa
  // hứa gì với ai. Gọi nó là "đã lên hóa đơn" là báo với BQT rằng một khoản đã
  // đòi trong khi chưa hề — và đó là con số họ mang đi họp.
  const nhap = d({ hoa_don_id: 'x', hoa_don_trang_thai: 'draft', hoa_don_tong: 9, hoa_don_da_tra: 0 })
  assert.equal(trangThaiDot(nhap), 'tren_hoa_don_nhap')
  assert.notEqual(trangThaiDot(nhap), 'con_thieu')
  assert.match(loiDot(nhap, kyVN), /chờ ban quản lý phát hành/)
})

test('câu giải thích nói rõ số tiền thiếu là của CẢ tờ hóa đơn', () => {
  // "Hóa đơn còn thiếu 300.000đ" đứng cạnh một đợt 111.111đ làm người đọc tưởng
  // mình còn nợ đúng đợt đó. Đây là chỗ dễ hiểu nhầm nhất của cả tính năng.
  const r = loiDot(
    d({ hoa_don_id: 'x', hoa_don_trang_thai: 'issued', hoa_don_tong: 411_111, hoa_don_da_tra: 111_111 }),
    kyVN,
  )
  assert.match(r, /300\.000đ/)
  assert.match(r, /CẢ tờ hóa đơn/)
  assert.match(r, /không tách ra được/)
})

test('mọi trạng thái đều có nhãn và tông màu', () => {
  for (const t of Object.keys(NHAN_DOT) as (keyof typeof NHAN_DOT)[]) {
    assert.ok(NHAN_DOT[t], t)
    assert.ok(TONE_DOT[t], t)
  }
  // "Chưa tới kỳ" không được tô đỏ: chưa tới hạn thì không phải là nợ.
  assert.equal(TONE_DOT.chua_len_hoa_don, 'trung')
  assert.equal(TONE_DOT.con_thieu, 'xau')
})

test('nhãn cách chia khớp đúng ràng buộc trong SQL', () => {
  const sql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  const m = sql.match(/cach_chia\s+text not null check \(cach_chia in \(([^)]+)\)\)/)
  assert.ok(m, 'không tìm thấy ràng buộc cach_chia trong schema.sql')
  const trongSql = m![1].split(',').map((s) => s.trim().replace(/'/g, ''))
  assert.deepEqual([...trongSql].sort(), Object.keys(NHAN_CACH_CHIA).sort())
})

test('gánh nặng nói theo THÁNG, vì đó mới là con số người ta quyết định dựa vào', () => {
  // 2,1 tỷ / 468 căn = 4.487.179 một căn. Chia 3 đợt còn 1.495.726 một tháng.
  const g = ganhNang(2_100_000_000, 468, 3)!
  assert.equal(g.moiCan, 4_487_179)
  assert.equal(g.moiThang, 1_495_726)
  // Một đợt thì mỗi tháng bằng cả khoản — không được ra số khác.
  assert.equal(ganhNang(2_100_000_000, 468, 1)!.moiThang, 4_487_179)
  assert.equal(ganhNang(1_000, 0, 3), null)
})

test('moiKy làm tròn XUỐNG, không tạo ra đồng nào không ai phải trả', () => {
  assert.equal(moiKy(1_000_000, 3), 333_333)
  assert.equal(moiKy(1_000_001, 3), 333_333)
  assert.equal(moiKy(100, 0), 100)
})

test('các kỳ chạy đúng sang năm mới', () => {
  // 11/2026 + 4 đợt phải sang 02/2027, không phải 11..14/2026.
  assert.deepEqual(
    cacKy('2026-11-01', 4),
    ['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'],
  )
  assert.deepEqual(cacKy('2026-12-01', 2), ['2026-12-01', '2027-01-01'])
  assert.deepEqual(cacKy('', 3), [])
})

test('kỳ viết theo tháng, không viết ngày', () => {
  // Hóa đơn là của một THÁNG. Hiện "01/10/2026" làm người ta tưởng hạn nộp.
  assert.equal(kyVN('2026-10-01'), '10/2026')
})

test('gom theo từng kế hoạch × từng căn, chủ hai căn không bị trộn', () => {
  const rows = [
    { ke_hoach_id: 'k1', ten: 'Sơn', nghi_quyet: 'NQ-1', so_dot: 2, unit_id: 'u1', ma_can: 'A', tong_phai_tra: 200, huy_luc: null, thu_tu: 1 },
    { ke_hoach_id: 'k1', ten: 'Sơn', nghi_quyet: 'NQ-1', so_dot: 2, unit_id: 'u1', ma_can: 'A', tong_phai_tra: 200, huy_luc: null, thu_tu: 2 },
    { ke_hoach_id: 'k1', ten: 'Sơn', nghi_quyet: 'NQ-1', so_dot: 2, unit_id: 'u2', ma_can: 'B', tong_phai_tra: 300, huy_luc: null, thu_tu: 1 },
    { ke_hoach_id: 'k2', ten: 'Bơm', nghi_quyet: 'NQ-2', so_dot: 1, unit_id: 'u1', ma_can: 'A', tong_phai_tra: 50, huy_luc: null, thu_tu: 1 },
  ]
  const g = gomTheoKeHoach(rows)
  assert.equal(g.length, 3)
  assert.equal(g.find((x) => x.ke_hoach_id === 'k1' && x.unit_id === 'u1')!.dot.length, 2)
  assert.equal(g.find((x) => x.ke_hoach_id === 'k1' && x.unit_id === 'u2')!.dot.length, 1)
  assert.equal(g.find((x) => x.ke_hoach_id === 'k2')!.dot.length, 1)
})
