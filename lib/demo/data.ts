// ─────────────────────────────────────────────────────────────────────────────
// DỮ LIỆU GIẢ CHO BẢN DEMO. Không phải dữ liệu thật, không đọc database.
//
// Toàn bộ thư mục app/demo chạy trên đúng file này — không import supabase,
// không có service key, không có đường nào ra DB thật. Cố ý như vậy: bản demo
// bỏ qua đăng nhập, nên nó tuyệt đối không được chạm vào dữ liệu thật.
//
// Đây là code VỨT ĐI sau khi chốt giao diện. Đừng dùng lại kiểu dữ liệu ở đây
// cho app thật — kiểu thật sinh từ DB, nằm ở lib/supabase/database.types.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Ngày lệch n ngày so với hôm nay, dạng YYYY-MM-DD. */
export function ngay(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Kỳ hóa đơn lệch n tháng, dạng YYYY-MM-01. */
export function ky(n: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 8) + '01'
}

export const DU_AN = { id: 'demo-project', ten: 'Sunrise Riverside' }

// Người đang xem bản demo: chủ hộ P1-10.01, đồng thời được bật vai BQL để
// xem được cả hai phía mà không phải đăng nhập hai lần.
export const TOI = { id: 'demo-me', ho_ten: 'Ngô Mạnh Hà', can: 'P1-10.01' }

export type CanHo = {
  id: string
  code: string
  toa: string
  tang: number
  dien_tich: number
  vai_tro: string
}

export const CAN_CUA_TOI: CanHo[] = [
  { id: 'u1', code: 'P1-10.01', toa: 'Park 1', tang: 10, dien_tich: 67, vai_tro: 'Chủ hộ' },
  { id: 'u2', code: 'P2-08.05', toa: 'Park 2', tang: 8, dien_tich: 55, vai_tro: 'Người thuê' },
]

export type DongHoaDon = {
  id: string
  mo_ta: string
  so_luong: number
  don_gia: number
  thanh_tien: number
}

export type HoaDon = {
  id: string
  can: string
  ky: string
  tong: number
  da_tra: number
  trang_thai: 'issued' | 'partial' | 'paid'
  han: string
  dong: DongHoaDon[]
}

const DONG_THANG_NAY: DongHoaDon[] = [
  { id: 'l1', mo_ta: 'Phí quản lý', so_luong: 67, don_gia: 16500, thanh_tien: 1105500 },
  { id: 'l2', mo_ta: 'Tiền điện', so_luong: 150, don_gia: 3200, thanh_tien: 480000 },
  { id: 'l3', mo_ta: 'Tiền nước', so_luong: 12, don_gia: 11500, thanh_tien: 138000 },
  { id: 'l4', mo_ta: 'Phí gửi ô tô', so_luong: 1, don_gia: 1200000, thanh_tien: 1200000 },
  { id: 'l5', mo_ta: 'Phí thu gom rác', so_luong: 1, don_gia: 60000, thanh_tien: 60000 },
]

export const HOA_DON: HoaDon[] = [
  {
    id: 'i1', can: 'P1-10.01', ky: ky(0), tong: 2983500, da_tra: 0,
    trang_thai: 'issued', han: ngay(3), dong: DONG_THANG_NAY,
  },
  {
    id: 'i2', can: 'P1-10.01', ky: ky(-1), tong: 2540000, da_tra: 1000000,
    trang_thai: 'partial', han: ngay(-27),
    dong: [
      { id: 'l6', mo_ta: 'Phí quản lý', so_luong: 67, don_gia: 16500, thanh_tien: 1105500 },
      { id: 'l7', mo_ta: 'Tiền điện', so_luong: 106, don_gia: 3200, thanh_tien: 339200 },
      { id: 'l8', mo_ta: 'Phí gửi ô tô', so_luong: 1, don_gia: 1200000, thanh_tien: 1200000 },
    ],
  },
  {
    id: 'i3', can: 'P1-10.01', ky: ky(-2), tong: 2410000, da_tra: 2410000,
    trang_thai: 'paid', han: ngay(-57),
    dong: [
      { id: 'l9', mo_ta: 'Phí quản lý', so_luong: 67, don_gia: 16500, thanh_tien: 1105500 },
      { id: 'l10', mo_ta: 'Tiền điện', so_luong: 45, don_gia: 3200, thanh_tien: 144500 },
      { id: 'l11', mo_ta: 'Phí gửi ô tô', so_luong: 1, don_gia: 1200000, thanh_tien: 1200000 },
    ],
  },
]

export type YeuCau = {
  id: string
  tieu_de: string
  can: string
  loai: string
  uu_tien: 'low' | 'normal' | 'high' | 'urgent'
  trang_thai: 'new' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  tao_luc: string
  han_xu_ly: string
  xong_luc: string | null
  nguoi_xu_ly: string | null
  danh_gia: number | null
  mo_ta: string
  lich_su: { luc: string; ai: string; viec: string }[]
}

export const YEU_CAU: YeuCau[] = [
  {
    id: 't1', tieu_de: 'Rò nước trần nhà vệ sinh', can: 'P1-10.01', loai: 'plumbing',
    uu_tien: 'high', trang_thai: 'in_progress', tao_luc: ngay(-1), han_xu_ly: ngay(0),
    xong_luc: null, nguoi_xu_ly: 'Trần Văn Kỹ (kỹ thuật)', danh_gia: null,
    mo_ta: 'Trần nhà vệ sinh nhỏ giọt liên tục từ tối qua, sàn đọng nước.',
    lich_su: [
      { luc: ngay(-1), ai: 'Ngô Mạnh Hà', viec: 'Tạo yêu cầu' },
      { luc: ngay(-1), ai: 'Lê Thị BQL', viec: 'Phân công cho Trần Văn Kỹ' },
      { luc: ngay(0), ai: 'Trần Văn Kỹ', viec: 'Bắt đầu xử lý — đã lên kiểm tra căn tầng trên' },
    ],
  },
  {
    id: 't2', tieu_de: 'Thang máy số 2 kêu to khi lên tầng 10', can: 'P1-10.01',
    loai: 'elevator', uu_tien: 'urgent', trang_thai: 'resolved', tao_luc: ngay(-6),
    han_xu_ly: ngay(-6), xong_luc: ngay(-5), nguoi_xu_ly: 'Hãng bảo trì Otis', danh_gia: null,
    mo_ta: 'Thang kêu ken két đoạn từ tầng 8 lên 10, có rung nhẹ.',
    lich_su: [
      { luc: ngay(-6), ai: 'Ngô Mạnh Hà', viec: 'Tạo yêu cầu' },
      { luc: ngay(-6), ai: 'Lê Thị BQL', viec: 'Chuyển hãng bảo trì — mức khẩn cấp' },
      { luc: ngay(-5), ai: 'Hãng bảo trì Otis', viec: 'Đã thay ray dẫn hướng, chạy thử 20 lượt' },
    ],
  },
  {
    id: 't3', tieu_de: 'Xe máy đỗ chắn lối thoát hiểm tầng hầm B1', can: 'P2-08.05',
    loai: 'security', uu_tien: 'normal', trang_thai: 'closed', tao_luc: ngay(-14),
    han_xu_ly: ngay(-13), xong_luc: ngay(-13), nguoi_xu_ly: 'Đội bảo vệ', danh_gia: 5,
    mo_ta: 'Khu vực gần thang bộ B1 bị 3 xe máy đỗ chắn hết lối.',
    lich_su: [
      { luc: ngay(-14), ai: 'Ngô Mạnh Hà', viec: 'Tạo yêu cầu' },
      { luc: ngay(-13), ai: 'Đội bảo vệ', viec: 'Đã liên hệ chủ xe và dời xe, dán biển cấm đỗ' },
      { luc: ngay(-13), ai: 'Ngô Mạnh Hà', viec: 'Đánh giá 5 sao' },
    ],
  },
]

// ── Phía BQL ──

export type YeuCauBQL = YeuCau & { nguoi_bao: string }

export const YEU_CAU_TOAN_KHU: YeuCauBQL[] = [
  { ...YEU_CAU[0], nguoi_bao: 'Ngô Mạnh Hà' },
  {
    id: 't4', tieu_de: 'Mất nước tầng 12 tòa P1', can: 'P1-12.03', loai: 'water_outage',
    uu_tien: 'urgent', trang_thai: 'new', tao_luc: ngay(0), han_xu_ly: ngay(-1),
    xong_luc: null, nguoi_xu_ly: null, danh_gia: null, nguoi_bao: 'Phạm Thu Hằng',
    mo_ta: 'Cả tầng 12 không có nước từ 6h sáng.',
    lich_su: [{ luc: ngay(0), ai: 'Phạm Thu Hằng', viec: 'Tạo yêu cầu' }],
  },
  {
    id: 't5', tieu_de: 'Đèn hành lang tầng 5 cháy 3 bóng', can: 'P2-05.02',
    loai: 'electrical', uu_tien: 'low', trang_thai: 'assigned', tao_luc: ngay(-2),
    han_xu_ly: ngay(1), xong_luc: null, nguoi_xu_ly: 'Trần Văn Kỹ (kỹ thuật)',
    danh_gia: null, nguoi_bao: 'Vũ Đình Long',
    mo_ta: 'Ba bóng đèn hành lang phía cuối tầng không sáng.',
    lich_su: [
      { luc: ngay(-2), ai: 'Vũ Đình Long', viec: 'Tạo yêu cầu' },
      { luc: ngay(-2), ai: 'Lê Thị BQL', viec: 'Phân công cho Trần Văn Kỹ' },
    ],
  },
  { ...YEU_CAU[1], nguoi_bao: 'Ngô Mạnh Hà' },
]

export type DongCongNo = {
  unit_id: string
  unit_code: string
  building_code: string
  so_hoa_don: number
  con_no: number
  han_cu_nhat: string
  so_ngay_qua_han: number
  ten_lien_he: string | null
  dien_thoai: string | null
}

// Cùng hình dạng với RPC bql_debt_report(), để màn demo và màn thật đọc giống nhau.
export const CONG_NO: DongCongNo[] = [
  {
    unit_id: 'u5', unit_code: 'P2-11.04', building_code: 'P2', so_hoa_don: 4,
    con_no: 11840000, han_cu_nhat: ngay(-118), so_ngay_qua_han: 118,
    ten_lien_he: 'Đặng Quốc Bảo', dien_thoai: '0903118844',
  },
  {
    unit_id: 'u6', unit_code: 'P1-07.02', building_code: 'P1', so_hoa_don: 2,
    con_no: 5320000, han_cu_nhat: ngay(-62), so_ngay_qua_han: 62,
    ten_lien_he: 'Hoàng Thị Mai', dien_thoai: '0912640022',
  },
  {
    unit_id: 'u7', unit_code: 'P2-03.01', building_code: 'P2', so_hoa_don: 2,
    con_no: 4180000, han_cu_nhat: ngay(-45), so_ngay_qua_han: 45,
    // Căn chưa có chủ hộ đang hoạt động — nợ vẫn phải hiện ra.
    ten_lien_he: null, dien_thoai: null,
  },
  {
    unit_id: 'u8', unit_code: 'P1-09.03', building_code: 'P1', so_hoa_don: 1,
    con_no: 2760000, han_cu_nhat: ngay(-12), so_ngay_qua_han: 12,
    ten_lien_he: 'Nguyễn Văn Thành', dien_thoai: '0987120033',
  },
  {
    unit_id: 'u2', unit_code: 'P1-10.02', building_code: 'P1', so_hoa_don: 1,
    con_no: 2540000, han_cu_nhat: ngay(-3), so_ngay_qua_han: 3,
    ten_lien_he: 'Trịnh Hải Yến', dien_thoai: '0977030055',
  },
  {
    unit_id: 'u1', unit_code: 'P1-10.01', building_code: 'P1', so_hoa_don: 2,
    con_no: 4523500, han_cu_nhat: ngay(-27), so_ngay_qua_han: 27,
    ten_lien_he: 'Ngô Mạnh Hà', dien_thoai: '0901234567',
  },
  {
    unit_id: 'u9', unit_code: 'P2-06.06', building_code: 'P2', so_hoa_don: 1,
    con_no: 1980000, han_cu_nhat: ngay(5), so_ngay_qua_han: -5,
    ten_lien_he: 'Lý Gia Huy', dien_thoai: '0933050077',
  },
]

export const HOA_DON_KY_NAY = [
  { can: 'P1-10.01', tong: 2983500, trang_thai: 'issued' as const },
  { can: 'P1-10.02', tong: 2540000, trang_thai: 'issued' as const },
  { can: 'P1-07.02', tong: 2660000, trang_thai: 'issued' as const },
  { can: 'P1-09.03', tong: 2760000, trang_thai: 'issued' as const },
  { can: 'P2-03.01', tong: 2090000, trang_thai: 'draft' as const },
  { can: 'P2-06.06', tong: 1980000, trang_thai: 'draft' as const },
  { can: 'P2-08.05', tong: 1870000, trang_thai: 'draft' as const },
  { can: 'P2-11.04', tong: 2960000, trang_thai: 'paid' as const },
]

// Tài khoản GIẢ, cố ý chọn dãy số không thể là số thật, để nếu ai lỡ quét mã
// demo thì cũng không có nơi nào nhận tiền.
export const NGAN_HANG_DEMO = {
  bin: '970436',              // Vietcombank, theo chuẩn NAPAS
  soTaiKhoan: '0000000000',
  ten: 'BAN QUAN LY SUNRISE RIVERSIDE (DEMO)',
}
