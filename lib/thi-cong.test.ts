import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  NHAN_LOAI, NHAN_TRANG_THAI, TONE_TRANG_THAI,
  changKyQuy, goiYKyQuy, loiKhoangNgay, loiKhungGio, soNgay, type KyQuy,
} from './thi-cong.ts'

const k = (p: Partial<KyQuy>): KyQuy => ({
  ky_quy_phai_nop: 10_000_000, ky_quy_da_nop: 0, ky_quy_tru: 0, ky_quy_hoan: 0,
  ly_do_tru: null, trang_thai: 'da_duyet', ...p,
})

test('nhãn loại và trạng thái phủ đúng ràng buộc SQL', () => {
  const sql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  const l = sql.match(/loai\s+text not null check \(loai in \('chuyen_vao'[^)]*\)\)/)
  const t = sql.match(/trang_thai\s+text not null default 'cho_duyet'\s*\n\s*check \(trang_thai in \(([^)]+)\)\)/)
  assert.ok(l && t, 'không tìm thấy ràng buộc loai / trang_thai của dang_ky_thi_cong')
  const lay = (x: string) => (x.match(/'([a-z_]+)'/g) ?? []).map((v) => v.replace(/'/g, ''))
  assert.deepEqual(lay(l![0]).sort(), Object.keys(NHAN_LOAI).sort())
  const tt = lay(t![1])
  assert.deepEqual([...tt].sort(), Object.keys(NHAN_TRANG_THAI).sort())
  for (const v of tt) assert.ok(TONE_TRANG_THAI[v as keyof typeof TONE_TRANG_THAI], v)
})

test('"ký quỹ 10 triệu" phân biệt được PHẢI NỘP với ĐÃ NỘP', () => {
  // Hai câu đó ngược hẳn nhau về việc phải làm, mà một con số trần thì giống hệt.
  const chua = changKyQuy(k({ ky_quy_da_nop: 4_000_000 }))
  assert.equal(chua.buoc, 'chua_nop')
  assert.match(chua.loi, /Còn thiếu 6\.000\.000đ/)
  // Và nói ra hệ quả: chưa nộp đủ thì giấy phép chưa có hiệu lực.
  assert.match(chua.loi, /chưa có hiệu lực/)

  const du = changKyQuy(k({ ky_quy_da_nop: 10_000_000 }))
  assert.equal(du.buoc, 'da_nop_du')
  assert.match(du.loi, /Hoàn lại sau khi tất toán/)
})

test('tất toán nói ra cả ba con số, và lý do trừ', () => {
  const r = changKyQuy(k({
    trang_thai: 'hoan_thanh', ky_quy_da_nop: 10_000_000,
    ky_quy_tru: 3_000_000, ky_quy_hoan: 7_000_000, ly_do_tru: 'Xước sàn thang máy',
  }))
  assert.equal(r.buoc, 'da_tat_toan')
  assert.match(r.loi, /nhận 10\.000\.000đ/)
  assert.match(r.loi, /hoàn lại 7\.000\.000đ/)
  assert.match(r.loi, /Xước sàn thang máy/)

  // Không trừ đồng nào cũng phải nói ra — im lặng ở đây làm người ta tưởng bị trừ.
  const sach = changKyQuy(k({
    trang_thai: 'hoan_thanh', ky_quy_da_nop: 5_000_000, ky_quy_hoan: 5_000_000,
  }))
  assert.match(sach.loi, /Không trừ đồng nào/)
})

test('không yêu cầu ký quỹ là một trạng thái riêng, không phải "đã nộp đủ 0đ"', () => {
  const r = changKyQuy(k({ ky_quy_phai_nop: 0 }))
  assert.equal(r.buoc, 'khong_can')
  assert.doesNotMatch(r.loi, /0đ/)
})

test('khung giờ nói luôn chuyện chủ nhật', () => {
  // Chủ nhật là điều khoản hàng xóm khiếu nại nhiều nhất, nên nó phải nằm ngay
  // cạnh khung giờ chứ không nấp trong một ô tick ở đâu đó.
  assert.equal(loiKhungGio('08:00:00', '16:00:00', false), '08:00 – 16:00, không làm chủ nhật')
  assert.equal(loiKhungGio('08:00:00', '17:00:00', true), '08:00 – 17:00, kể cả chủ nhật')
})

test('khoảng ngày gộp năm khi cùng năm, và một ngày thì không hiện dấu gạch', () => {
  assert.equal(loiKhoangNgay('2026-09-08', '2026-09-22'), '08/09 – 22/09/2026')
  assert.equal(loiKhoangNgay('2026-12-28', '2027-01-05'), '28/12/2026 – 05/01/2027')
  // Chuyển nhà thường gói trong một ngày: "08/09 – 08/09" đọc như hai ngày.
  assert.equal(loiKhoangNgay('2026-09-08', '2026-09-08'), '08/09/2026')
})

test('số ngày tính CẢ HAI ĐẦU', () => {
  // Giấy phép 08/09–08/09 là một ngày làm việc, không phải không ngày nào.
  assert.equal(soNgay('2026-09-08', '2026-09-08'), 1)
  assert.equal(soNgay('2026-09-08', '2026-09-22'), 15)
  assert.equal(soNgay('2026-09-22', '2026-09-08'), 0)
})

test('mức ký quỹ chỉ là GỢI Ý, và tăng theo độ dài thi công', () => {
  assert.equal(goiYKyQuy('chuyen_vao', 1), 2_000_000)
  assert.equal(goiYKyQuy('thi_cong', 5), 5_000_000)
  assert.equal(goiYKyQuy('thi_cong', 15), 10_000_000)
  assert.equal(goiYKyQuy('thi_cong', 60), 20_000_000)
  // Thi công dài hơn thì rủi ro hỏng hạ tầng chung cao hơn — mức không được giảm.
  assert.ok(goiYKyQuy('thi_cong', 60) >= goiYKyQuy('thi_cong', 15))
  assert.ok(goiYKyQuy('thi_cong', 15) >= goiYKyQuy('thi_cong', 5))
})
