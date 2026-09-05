/**
 * Sơn lại mặt ngoài tháp A: 2,1 tỷ, chia theo m² cho 468 căn trên 33.696 m²,
 * thu làm 3 đợt.
 *
 * Mọi con số dưới đây CỘNG LẠI ĐÚNG. Một bản demo về tiền mà số không khớp thì
 * nó dạy sai đúng cái nó sinh ra để dạy — và người xem sẽ tin cả những chỗ khác.
 */

export const KE_HOACH = {
  id: 'son-mat-ngoai',
  ten: 'Sơn lại mặt ngoài tháp A',
  mo_ta:
    'Lớp sơn hiện tại phủ năm 2018, đã bong tróc ở mặt Tây. Ba nhà thầu chào giá, '
    + 'hội nghị chọn phương án của Nam Long theo nghị quyết NQ-05/2026.',
  tong_chi_phi: 2_100_000_000,
  cach_chia: 'theo_m2',
  so_dot: 3,
  ky_bat_dau: '2026-10-01',
  nghi_quyet: 'NQ-05/2026',
  ngay_nq: '2026-09-18',
  tong_dien_tich: 33_696,
  so_can: 468,
  lap_luc: '2026-09-20T02:00:00Z',
  huy_luc: null as string | null,
  ly_do_huy: null as string | null,
  // Đợt 1 + đợt 2 đã phát hành; đợt 3 chưa tới kỳ. Hai con số cộng lại đúng
  // 2.100.000.000 — đợt cuối ôm phần lẻ của cả 468 căn nên nó nhỉnh hơn.
  da_len_hoa_don: 1_399_999_834,
  chua_toi_ky: 700_000_166,
  so_can_con_no: 41,
  dot_da_qua: 2,
}

export type DongCan = {
  unit_id: string
  ma_can: string
  dien_tich: number
  dot: { thu_tu: number; ky: string; so_tien: number
         hoa_don_trang_thai: string | null; hoa_don_tong: number | null
         hoa_don_da_tra: number | null }[]
}

const dot = (a: number, b: number, c: number, tinhTrang: 'tra_du' | 'con_thieu') => [
  { thu_tu: 1, ky: '2026-10-01', so_tien: a,
    hoa_don_trang_thai: 'paid', hoa_don_tong: a + 1_406_000, hoa_don_da_tra: a + 1_406_000 },
  { thu_tu: 2, ky: '2026-11-01', so_tien: b,
    hoa_don_trang_thai: 'issued', hoa_don_tong: b + 1_287_000,
    hoa_don_da_tra: tinhTrang === 'tra_du' ? b + 1_287_000 : 0 },
  { thu_tu: 3, ky: '2026-12-01', so_tien: c,
    hoa_don_trang_thai: null, hoa_don_tong: null, hoa_don_da_tra: null },
]

// Diện tích lệch nhau hẳn, và hai căn có phần lẻ trên 0,5 nên được bù 1 đồng —
// đúng cái phương pháp phần dư lớn nhất làm. Số tròn trịa cả bảng thì người xem
// không thấy được vì sao phép chia này cần cẩn thận.
export const CAN: DongCan[] = [
  { unit_id: 'u1', ma_can: 'P1-03.02', dien_tich: 68.4,
    dot: dot(1_420_940, 1_420_940, 1_420_941, 'tra_du') },
  { unit_id: 'u2', ma_can: 'P1-10.01', dien_tich: 112.5,
    dot: dot(2_337_072, 2_337_072, 2_337_074, 'con_thieu') },
  { unit_id: 'u3', ma_can: 'P1-12.04', dien_tich: 54,
    dot: dot(1_121_795, 1_121_795, 1_121_795, 'tra_du') },
  { unit_id: 'u4', ma_can: 'P1-15.11', dien_tich: 96.2,
    dot: dot(1_998_456, 1_998_456, 1_998_458, 'con_thieu') },
  { unit_id: 'u5', ma_can: 'P2-19.02', dien_tich: 128.7,
    dot: dot(2_673_611, 2_673_611, 2_673_611, 'tra_du') },
]

/**
 * Căn của người đang xem ở bản demo cư dân — cố ý chọn căn có đợt 2 CÒN THIẾU.
 * Căn nào cũng trả đủ thì bản demo không bao giờ hiện ra câu khó nhất của cả
 * tính năng: "hóa đơn còn thiếu 2.337.072đ" là của CẢ tờ hóa đơn, không phải
 * riêng đợt này. Mã căn khớp với dòng tên ở đầu màn demo cư dân.
 */
export const CUA_TOI = CAN[1]
