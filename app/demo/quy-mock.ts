import type { DongQuy } from '@/components/quy-so'

// Bộ số cố ý bày đủ những gì người trực gặp trong năm đầu: số dư bàn giao, lãi
// quý, một khoản chi có nghị quyết, và MỘT LẦN GHI SAI đã được đảo — dòng sai
// vẫn nằm lại trong sổ, đó là cả điểm của thiết kế.
export const DONG: DongQuy[] = [
  { id: '1', loai: 'so_du_dau', ngay: '2026-01-01', dien_giai: 'Số dư bàn giao từ chủ đầu tư',
    so_tien: 2_184_500_000, nghi_quyet: null, ngay_nq: null, ghi_chu: 'Biên bản bàn giao quỹ 28/12/2025',
    da_dao: false, la_dong_dao: false, luy_ke: 2_184_500_000 },
  { id: '2', loai: 'lai', ngay: '2026-03-31', dien_giai: 'Lãi ngân hàng quý I',
    so_tien: 18_420_000, nghi_quyet: null, ngay_nq: null, ghi_chu: null,
    da_dao: false, la_dong_dao: false, luy_ke: 2_202_920_000 },
  { id: '3', loai: 'chi', ngay: '2026-04-10', dien_giai: 'Sửa thang máy tháp A',
    so_tien: -96_000_000, nghi_quyet: 'NQ-03/2026', ngay_nq: '2026-04-05',
    ghi_chu: 'Thanh toán đợt 1 cho Thiên Nam', da_dao: false, la_dong_dao: false, luy_ke: 2_106_920_000 },
  { id: '4', loai: 'chi', ngay: '2026-04-18', dien_giai: 'Sơn lại sảnh tầng 1',
    so_tien: -42_000_000, nghi_quyet: 'NQ-04/2026', ngay_nq: '2026-04-15', ghi_chu: null,
    da_dao: true, la_dong_dao: false, luy_ke: 2_064_920_000 },
  { id: '5', loai: 'dieu_chinh', ngay: '2026-04-20', dien_giai: 'Đảo: Sơn lại sảnh tầng 1',
    so_tien: 42_000_000, nghi_quyet: null, ngay_nq: null,
    ghi_chu: 'Khoản này thuộc phí quản lý, không phải quỹ bảo trì',
    da_dao: false, la_dong_dao: true, luy_ke: 2_106_920_000 },
  { id: '6', loai: 'thu', ngay: '2026-05-03', dien_giai: 'Thu 2% các căn bàn giao đợt 2',
    so_tien: 45_000_000, nghi_quyet: null, ngay_nq: null, ghi_chu: '9 căn tháp B',
    da_dao: false, la_dong_dao: false, luy_ke: 2_151_920_000 },
]
export const NGAN_HANG = 'Vietcombank'
export const SO_TK = '0011 0001 23456'
export const SO_DU_NH = 2_151_920_000
export const NGAY_DC = '2026-05-04'
