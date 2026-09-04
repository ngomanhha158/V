import type { CuocBQ } from '@/components/ket-qua-bq'
import type { KetQua } from '@/lib/bieu-quyet'

/**
 * Ba cuộc biểu quyết cố ý ở ba trạng thái KHÁC NHAU VỀ BẢN CHẤT, không phải
 * khác nhau về mức độ:
 *  · đang mở, đã đủ dự họp và đang trên ngưỡng;
 *  · đã kiểm phiếu và thông qua;
 *  · đã kiểm phiếu, 87,5% tán thành nhưng KHÔNG THÔNG QUA vì chưa đủ dự họp.
 *
 * Cuộc thứ ba là cuộc quan trọng nhất trong bản demo: nó là ca mà kiểm phiếu
 * tay hay kết luận ngược, và nhìn thấy nó một lần thì người dùng hiểu ngay vì
 * sao hệ thống tách hai ngưỡng ra làm hai con số riêng.
 */

// 468 căn, trung bình ~72 m².
const TONG = 33_696

export const CUOC: CuocBQ[] = [
  {
    id: 'mo',
    tieu_de: 'Thông qua mức phí quản lý 8.000đ/m²/tháng từ 01/2027',
    noi_dung:
      'Mức hiện hành 6.500đ/m² áp dụng từ 2024. Chi phí nhân sự và điện chung tăng '
      + '23% trong hai năm. Phương án B (7.200đ/m²) kèm cắt một ca trực đêm được '
      + 'trình bày ở phụ lục 2 của thông báo mời họp.',
    nguong_du_hop: 50, nguong_thong_qua: 50,
    tong_dien_tich: TONG, so_can: 468,
    mo_luc: '2026-11-02T01:00:00Z', dong_luc: null,
    huy_luc: null, ly_do_huy: null,
    kq_dien_tich_bo_phieu: null, kq_tan_thanh: null, kq_khong_tan_thanh: null,
    kq_trang: null, kq_du_hop: null, kq_thong_qua: null,
  },
  {
    id: 'thong-qua',
    tieu_de: 'Bầu Ban quản trị nhiệm kỳ 2026–2028',
    noi_dung: 'Danh sách 7 ứng viên kèm lý lịch trích ngang đã gửi kèm thông báo mời họp.',
    nguong_du_hop: 50, nguong_thong_qua: 50,
    tong_dien_tich: TONG, so_can: 468,
    mo_luc: '2026-06-01T01:00:00Z', dong_luc: '2026-06-15T10:00:00Z',
    huy_luc: null, ly_do_huy: null,
    kq_dien_tich_bo_phieu: 24_180, kq_tan_thanh: 21_015,
    kq_khong_tan_thanh: 2_340, kq_trang: 825,
    kq_du_hop: true, kq_thong_qua: true,
  },
  {
    id: 'thieu-du-hop',
    tieu_de: 'Thay đơn vị quản lý vận hành từ Quý II/2026',
    noi_dung:
      'Nội dung này theo quy chế hội nghị cần 75% diện tích tham gia biểu quyết '
      + 'mới đủ điều kiện tiến hành.',
    nguong_du_hop: 75, nguong_thong_qua: 50,
    tong_dien_tich: TONG, so_can: 468,
    mo_luc: '2026-03-01T01:00:00Z', dong_luc: '2026-03-20T09:30:00Z',
    huy_luc: null, ly_do_huy: null,
    kq_dien_tich_bo_phieu: 14_880, kq_tan_thanh: 13_020,
    kq_khong_tan_thanh: 1_110, kq_trang: 750,
    kq_du_hop: false, kq_thong_qua: false,
  },
]

/** Kiểm phiếu TẠM TÍNH của cuộc đang mở. */
export const DANG_TINH: KetQua = {
  dien_tich_bo_phieu: 18_333,
  tan_thanh: 12_940.5,
  khong_tan_thanh: 4_110,
  trang: 1_282.5,
  tong_dien_tich: TONG,
  so_can_da_bo: 254,
  ty_le_du_hop: 54.41,
  ty_le_tan_thanh: 70.59,
  du_hop: true,
  thong_qua: true,
}

export type DongCan = {
  ma_can: string
  dien_tich: number
  y_kien: 'tan_thanh' | 'khong_tan_thanh' | 'trang' | null
  bo_luc: string | null
}

export const TUNG_CAN: DongCan[] = [
  { ma_can: 'P1-03.02', dien_tich: 68.4, y_kien: 'tan_thanh', bo_luc: '2026-11-02T02:14:00Z' },
  { ma_can: 'P1-08.01', dien_tich: 112.5, y_kien: 'khong_tan_thanh', bo_luc: '2026-11-02T03:41:00Z' },
  { ma_can: 'P1-12.04', dien_tich: 54, y_kien: 'trang', bo_luc: '2026-11-03T12:05:00Z' },
  { ma_can: 'P1-15.11', dien_tich: 96.2, y_kien: null, bo_luc: null },
  { ma_can: 'P2-02.06', dien_tich: 72, y_kien: 'tan_thanh', bo_luc: '2026-11-04T01:30:00Z' },
  { ma_can: 'P2-08.03', dien_tich: 68.4, y_kien: null, bo_luc: null },
  { ma_can: 'P2-19.02', dien_tich: 128.7, y_kien: 'tan_thanh', bo_luc: '2026-11-05T09:12:00Z' },
]

/** Hai căn của cùng một chủ: một đã bỏ, một chưa. Chủ nhiều căn là người dễ bỏ
 *  sót nhất mà phiếu lại nặng nhất. */
export const CUA_TOI = [
  { unit_id: 'u1', ma_can: 'P1-08.01', dien_tich: 112.5, da_bo: true, y_kien: 'tan_thanh' },
  { unit_id: 'u2', ma_can: 'P2-19.02', dien_tich: 128.7, da_bo: false, y_kien: null },
]
