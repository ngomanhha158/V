import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  chiSoChinh, phanTram, quyTruoc, soVoiQuyTruoc, tenQuy, tyLe, type BaoCao,
} from './bao-cao.ts'

const b = (p: Partial<BaoCao>): BaoCao => ({
  nam: 2026, quy: 3, tu_ngay: '2026-07-01', den_ngay: '2026-09-30',
  hoa_don_phai_thu: 1_000_000_000, hoa_don_da_thu: 864_000_000,
  cong_no_cuoi_quy: 136_000_000, so_can: 468, so_can_no: 37,
  quy_bao_tri_dau: 2_100_000_000, quy_bao_tri_cuoi: 2_004_000_000,
  quy_chi_trong_quy: 96_000_000, chi_vat_tu: 12_400_000,
  so_yeu_cau: 240, so_yeu_cau_xong: 228, so_yeu_cau_dung_han: 208,
  so_danh_gia: 96, tong_diem: 413, so_thi_cong: 7,
  so_ban_giao_ca: 182, so_ban_giao_chua_ky: 4, ...p,
})

test('tên quý viết bằng số La Mã, đúng lối biên bản họp', () => {
  assert.equal(tenQuy(2026, 3), 'Quý III/2026')
  assert.equal(tenQuy(2026, 4), 'Quý IV/2026')
  assert.equal(tenQuy(2027, 1), 'Quý I/2027')
})

test('tỷ lệ làm tròn một chữ số và không chia cho 0', () => {
  assert.equal(tyLe(864, 1000), 86.4)
  assert.equal(tyLe(208, 228), 91.2)
  // Chưa phát hành hóa đơn nào thì tỷ lệ thu là 0, không phải NaN rơi lên màn hình.
  assert.equal(tyLe(0, 0), 0)
  assert.equal(phanTram(86.4), '86,4%')
})

test('ngưỡng nói ra thay vì để người đọc tự đoán', () => {
  const tot = chiSoChinh(b({}))
  assert.equal(tot[0].gia_tri, '86,4%')
  assert.equal(tot[0].tone, 'tot')
  // Dưới 75% là vấn đề quy trình thu, không phải vài hộ khó khăn.
  assert.equal(chiSoChinh(b({ hoa_don_da_thu: 700_000_000 })).find((c) => c.khoa === 'thu')!.tone, 'xau')
  assert.equal(chiSoChinh(b({ hoa_don_da_thu: 800_000_000 })).find((c) => c.khoa === 'thu')!.tone, 'canh')
})

test('điểm hài lòng ít phiếu thì KHÔNG tô màu và nói rõ là quá ít', () => {
  // BQT mang một con số ba phiếu ra họp là tệ hơn không có con số nào.
  const it = chiSoChinh(b({ so_danh_gia: 3, tong_diem: 15 })).find((c) => c.khoa === 'diem')!
  assert.equal(it.gia_tri, '5 / 5')
  assert.equal(it.tone, 'trung')
  assert.match(it.phu!, /quá ít để kết luận/)

  const khong = chiSoChinh(b({ so_danh_gia: 0, tong_diem: 0 })).find((c) => c.khoa === 'diem')!
  assert.equal(khong.gia_tri, '—')
  assert.match(khong.phu!, /Chưa có đánh giá nào/)

  const du = chiSoChinh(b({})).find((c) => c.khoa === 'diem')!
  assert.equal(du.gia_tri, '4,3 / 5')
  assert.equal(du.tone, 'tot')
})

test('SLA tính trên số ĐÃ XONG, không trên số tiếp nhận', () => {
  // Chia cho số tiếp nhận thì một quý nhiều việc dở dang tự làm tỷ lệ xấu đi,
  // trong khi những việc đó chưa tới hạn kết luận.
  const c = chiSoChinh(b({})).find((x) => x.khoa === 'sla')!
  assert.equal(c.gia_tri, '91,2%')
  assert.match(c.phu!, /208\/228 việc đã xong/)
  assert.match(c.phu!, /240 việc tiếp nhận/)
})

test('so với quý trước dùng hai bản ĐÃ ĐÓNG BĂNG', () => {
  const nay = b({})
  const truoc = b({ nam: 2026, quy: 2, hoa_don_da_thu: 820_000_000 })
  const r = soVoiQuyTruoc(nay, truoc)!
  assert.equal(r.ty_le_thu_truoc, 82)
  assert.equal(r.lech, 4.4)
  assert.match(r.loi, /tăng 4,4% so với Quý II\/2026/)

  const giam = soVoiQuyTruoc(b({ hoa_don_da_thu: 800_000_000 }), truoc)!
  assert.match(giam.loi, /giảm 2% so với Quý II\/2026/)
  // Bằng nhau thì không hiện mũi tên nào.
  assert.match(soVoiQuyTruoc(truoc, truoc)!.loi, /bằng Quý II\/2026/)
  // Chưa có quý trước thì không bịa ra một xu hướng.
  assert.equal(soVoiQuyTruoc(nay, null), null)
})

test('quý liền trước bắc cầu đúng sang năm', () => {
  assert.deepEqual(quyTruoc(2026, 1), { nam: 2025, quy: 4 })
  assert.deepEqual(quyTruoc(2026, 4), { nam: 2026, quy: 3 })
})
