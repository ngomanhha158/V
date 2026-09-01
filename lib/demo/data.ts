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

// ── Thông báo cá nhân (bảng notifications) ──
export type ThongBao = {
  id: number
  kind: 'invoice' | 'ticket' | 'announcement' | 'approval'
  ref_id: string | null
  title: string
  body: string | null
  read_at: string | null
  created_at: string
}

const gio = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

export const THONG_BAO: ThongBao[] = [
  {
    id: 5, kind: 'invoice', ref_id: 'i1',
    title: 'Hoa don 08/2026 sap den han',
    body: 'Con lai 2.983.500d, han 01/09/2026',
    read_at: null, created_at: gio(3),
  },
  {
    id: 4, kind: 'ticket', ref_id: 't1',
    title: 'Yêu cầu của bạn đang được xử lý',
    body: 'Trần Văn Kỹ đã lên kiểm tra căn tầng trên.',
    read_at: null, created_at: gio(9),
  },
  {
    id: 3, kind: 'announcement', ref_id: null,
    title: 'Thông báo mới: Cắt nước bảo trì bể ngầm',
    body: 'Toàn tòa Park 1, thứ Bảy 8h–11h.',
    read_at: null, created_at: gio(26),
  },
  {
    id: 2, kind: 'ticket', ref_id: 't2',
    title: 'Yêu cầu đã hoàn thành',
    body: 'Thang máy số 2 — đã thay ray dẫn hướng, chạy thử 20 lượt.',
    read_at: gio(100), created_at: gio(120),
  },
  {
    id: 1, kind: 'invoice', ref_id: 'i3',
    title: 'Hoa don 06/2026 da thanh toan',
    body: 'Cảm ơn anh/chị đã thanh toán đúng hạn.',
    read_at: gio(700), created_at: gio(720),
  },
]

// ── Sổ tay cư dân (bảng documents) ──
export type MucSoTay = {
  id: string; section: string; title: string; body: string; version: number
}

export const SO_TAY: MucSoTay[] = [
  {
    id: 'd1', section: 'Thú cưng', version: 2,
    title: 'Quy định nuôi thú cưng trong căn hộ',
    body: 'Mỗi căn hộ được nuôi tối đa 2 thú cưng, phải đăng ký với ban quản lý và tiêm phòng đầy đủ.\n\nKhi ra khu vực chung, chó phải có dây dắt và rọ mõm nếu thuộc giống lớn. Chủ nuôi tự dọn vệ sinh cho thú cưng của mình.\n\nThang máy: ưu tiên dùng thang hàng. Nếu dùng thang khách, bế thú cưng hoặc nhường lượt khi có người e ngại.',
  },
  {
    id: 'd2', section: 'Rác thải', version: 1,
    title: 'Giờ đổ rác và phân loại',
    body: 'Phòng rác mỗi tầng mở cả ngày. Rác sinh hoạt buộc kín túi trước khi bỏ vào thùng.\n\nRác cồng kềnh (đồ gỗ, nệm, thiết bị điện) không để ở phòng rác tầng — báo ban quản lý để bố trí đưa xuống khu tập kết.\n\nPin, bóng đèn và thiết bị điện tử bỏ vào thùng riêng ở sảnh tầng 1.',
  },
  {
    id: 'd3', section: 'Sửa chữa', version: 1,
    title: 'Giờ được thi công trong căn hộ',
    body: 'Thi công gây tiếng ồn chỉ được thực hiện từ 8h00 đến 17h00 các ngày trong tuần, và 8h00 đến 12h00 thứ Bảy. Chủ nhật và ngày lễ không thi công.\n\nTrước khi sửa chữa lớn, đăng ký với ban quản lý ít nhất 3 ngày để thông báo cho các căn lân cận.\n\nKhông đục phá kết cấu chịu lực trong mọi trường hợp.',
  },
  {
    id: 'd4', section: 'Gửi xe', version: 1,
    title: 'Đăng ký xe và thẻ ra vào',
    body: 'Mỗi căn hộ được đăng ký tối đa 1 ô tô và 2 xe máy theo giá niêm yết. Xe thứ hai trở đi tính giá dịch vụ.\n\nThẻ xe gắn với biển số cụ thể, không dùng chung. Mất thẻ báo ngay để khóa và cấp lại.\n\nKhông đỗ xe chắn lối thoát hiểm và họng cứu hỏa — vi phạm sẽ bị cẩu xe.',
  },
  {
    id: 'd5', section: 'An ninh', version: 1,
    title: 'Khách tới thăm và người giúp việc',
    body: 'Khách vào tòa cần đăng ký tại quầy lễ tân và được cư dân xác nhận.\n\nNgười giúp việc làm thường xuyên: chủ hộ đăng ký làm thẻ tạm, khai báo họ tên và số căn cước.\n\nCư dân chịu trách nhiệm về hành vi của khách và người giúp việc do mình bảo lãnh.',
  },
]

// ── Bảng tin (bảng announcements) ──
export type TinBangTin = {
  id: string
  title: string
  body: string
  is_urgent: boolean
  published_at: string | null
  building_id: string | null
  floor_no: number | null
  unit_id: string | null
  documents: { id: string; title: string; section: string } | null
}

export const BANG_TIN: TinBangTin[] = [
  {
    id: 'a1', is_urgent: true, published_at: gio(26),
    building_id: 'b1', floor_no: null, unit_id: null,
    title: 'Cắt nước bảo trì bể ngầm — thứ Bảy 8h–11h',
    body: 'Ban quản lý tiến hành súc rửa bể nước ngầm tòa Park 1.\n\nNước sẽ ngừng cấp từ 8h00 đến khoảng 11h00 thứ Bảy ngày 05/09. Đề nghị các hộ tích trữ nước dùng trước 8h.\n\nNếu quá 11h30 chưa có nước, gọi trực ban 0901 234 567.',
    documents: null,
  },
  {
    id: 'a2', is_urgent: false, published_at: gio(50),
    building_id: null, floor_no: null, unit_id: null,
    title: 'Nhắc lại quy định nuôi thú cưng',
    body: 'Gần đây ban quản lý nhận nhiều phản ánh về chó thả rông ở khu vực sảnh và công viên nội khu.\n\nĐề nghị các hộ nuôi chó tuân thủ quy định dây dắt và dọn vệ sinh. Ban quản lý sẽ nhắc trực tiếp các trường hợp tái diễn.',
    documents: { id: 'd1', title: 'Quy định nuôi thú cưng trong căn hộ', section: 'Thú cưng' },
  },
  {
    id: 'a3', is_urgent: false, published_at: gio(74),
    building_id: 'b1', floor_no: 10, unit_id: null,
    title: 'Sơn lại hành lang tầng 10',
    body: 'Đội thi công sẽ sơn lại hành lang tầng 10 tòa Park 1 trong hai ngày thứ Ba và thứ Tư.\n\nCó mùi sơn nhẹ trong giờ làm việc. Các hộ nên đóng cửa chính và bật thông gió.',
    documents: { id: 'd3', title: 'Giờ được thi công trong căn hộ', section: 'Sửa chữa' },
  },
  {
    id: 'a4', is_urgent: false, published_at: gio(200),
    building_id: null, floor_no: null, unit_id: 'u1',
    title: 'Thẻ xe của căn hộ sắp hết hạn',
    body: 'Thẻ gửi ô tô biển 51K-123.45 của căn P1-10.01 hết hạn ngày 15/09.\n\nMời anh/chị qua văn phòng ban quản lý gia hạn trong giờ hành chính.',
    documents: { id: 'd4', title: 'Đăng ký xe và thẻ ra vào', section: 'Gửi xe' },
  },
]

// ── Dashboard BQT (bql_dashboard + bql_dashboard_thang) ──
// Số cố ý KHÔNG đẹp: 82% đúng hạn, 3 yêu cầu treo quá hạn, tháng trắng ở giữa
// chuỗi. Demo toàn 100% xanh lá chẳng chứng minh được gì — cái cần cho người
// xem thấy chính là màn hình trông thế nào lúc có chuyện.
export const DASHBOARD = {
  tu_ngay: ky(0), den_ngay: ngay(0),
  tong_ticket: 34, ticket_tu_choi: 2, ticket_khong_co_sla: 3,
  ticket_co_ket_luan: 28, ticket_dung_sla: 23, ticket_chua_ket_luan: 1,
  ty_le_dung_sla: 82.1,
  gio_phan_hoi_trung_vi: 0.4,
  gio_xu_ly_trung_vi: 5.2,
  gio_xu_ly_trung_binh: 11.8,   // lệch xa trung vị = có cái đang bị treo
  gio_xu_ly_p90: 38.5,
  diem_hai_long: 4.35, so_luot_danh_gia: 17, ty_le_danh_gia: 60.7,
  dang_mo_hien_tai: 9, qua_han_hien_tai: 3,
  cong_no: 24680000, cong_no_qua_han: 15420000, so_can_no: 11,
  phai_thu_ky: 61200000, da_thu_ky: 48350000, tien_ve_ky: 52100000,
}

export const DASHBOARD_THANG = [
  { thang: ky(-5), ticket_moi: 21, ticket_co_ket_luan: 19, ticket_dung_sla: 17,
    ty_le_dung_sla: 89.5, gio_xu_ly_trung_vi: 4.1,
    phai_thu: 58900000, da_thu: 57200000, tien_ve: 56800000 },
  { thang: ky(-4), ticket_moi: 26, ticket_co_ket_luan: 24, ticket_dung_sla: 20,
    ty_le_dung_sla: 83.3, gio_xu_ly_trung_vi: 5.6,
    phai_thu: 59400000, da_thu: 55100000, tien_ve: 58300000 },
  // Tháng nghỉ Tết: không yêu cầu nào ngã ngũ -> tỷ lệ null, đường đứt đoạn.
  { thang: ky(-3), ticket_moi: 0, ticket_co_ket_luan: 0, ticket_dung_sla: 0,
    ty_le_dung_sla: null, gio_xu_ly_trung_vi: null,
    phai_thu: 59400000, da_thu: 51800000, tien_ve: 49200000 },
  { thang: ky(-2), ticket_moi: 31, ticket_co_ket_luan: 29, ticket_dung_sla: 22,
    ty_le_dung_sla: 75.9, gio_xu_ly_trung_vi: 7.8,
    phai_thu: 60100000, da_thu: 58900000, tien_ve: 61400000 },
  { thang: ky(-1), ticket_moi: 29, ticket_co_ket_luan: 28, ticket_dung_sla: 24,
    ty_le_dung_sla: 85.7, gio_xu_ly_trung_vi: 5.9,
    phai_thu: 60700000, da_thu: 59800000, tien_ve: 57600000 },
  { thang: ky(0), ticket_moi: 34, ticket_co_ket_luan: 28, ticket_dung_sla: 23,
    ty_le_dung_sla: 82.1, gio_xu_ly_trung_vi: 5.2,
    phai_thu: 61200000, da_thu: 48350000, tien_ve: 52100000 },
]

// ── Đối soát tiền về (bank_transactions) ──
// Cố ý gồm đủ các kiểu ghi sai mà BQL gặp thật: ghi mỗi tên mình, thiếu tiền
// tố VB, gõ nhầm số căn, và một khoản của nhà thầu lọt vào tài khoản khu.
export type GiaoDichDemo = {
  id: string; provider: string; bank_ref: string | null; amount: number
  content: string; paid_at: string; trang_thai: string; cach_khop: string | null
  con_du: number; unit_code: string | null; ghi_chu: string | null
  goi_y: string[] | null
}

/** n ngày trước, cố định lúc h giờ 30 (UTC) — để mốc thời gian trông thật. */
const ngayGio = (n: number, h = 2) =>
  new Date(Date.now() - n * 86400_000).toISOString().slice(0, 11)
  + String(h).padStart(2, '0') + ':30:00.000Z'

export const DOI_SOAT: GiaoDichDemo[] = [
  { id: 'gd-1', provider: 'sepay', bank_ref: 'MBVCB.9921334', amount: 2540000,
    content: 'NGUYEN VAN MINH chuyen tien thang 8', paid_at: ngayGio(1),
    trang_thai: 'chua_khop', cach_khop: null, con_du: 0, unit_code: null,
    ghi_chu: null, goi_y: [] },
  { id: 'gd-2', provider: 'sepay', bank_ref: 'MBVCB.9921702', amount: 2660000,
    content: 'CT DEN:0123 P1-07.02 phi quan ly', paid_at: ngayGio(1, 7),
    trang_thai: 'chua_khop', cach_khop: null, con_du: 0, unit_code: null,
    ghi_chu: null, goi_y: ['P1-07.02'] },
  { id: 'gd-3', provider: 'sepay', bank_ref: 'MBVCB.9922110', amount: 1500000,
    content: 'tra tien nuoc can 903', paid_at: ngayGio(2),
    trang_thai: 'chua_khop', cach_khop: null, con_du: 0, unit_code: null,
    ghi_chu: null, goi_y: [] },
  { id: 'gd-4', provider: 'sepay', bank_ref: 'MBVCB.9920881', amount: 2983500,
    content: 'CT DEN:VB P1-10.01 202608 FT24', paid_at: ngayGio(3),
    trang_thai: 'da_khop', cach_khop: 'ma_can', con_du: 0, unit_code: 'P1-10.01',
    ghi_chu: null, goi_y: null },
  { id: 'gd-5', provider: 'sepay', bank_ref: 'MBVCB.9920902', amount: 3500000,
    content: 'VB P2-11.04 202608', paid_at: ngayGio(4),
    trang_thai: 'da_khop', cach_khop: 'ma_can', con_du: 540000, unit_code: 'P2-11.04',
    ghi_chu: null, goi_y: null },
  { id: 'gd-6', provider: 'sepay', bank_ref: 'MBVCB.9920415', amount: 12000000,
    content: 'CTY TNHH THANG MAY AN PHAT hoan ung', paid_at: ngayGio(6),
    trang_thai: 'bo_qua', cach_khop: null, con_du: 0, unit_code: null,
    ghi_chu: 'Nhà thầu hoàn ứng, không phải tiền cư dân', goi_y: null },
]

// ── Go-live (N29) ──
// Cố ý CHƯA đủ điều kiện: thiếu tài khoản ngân hàng, còn 3 người chờ duyệt.
// Demo mà mọi thứ xanh hết thì không cho người xem thấy màn này để làm gì.
export const SAN_SANG = {
  so_toa: 2, so_can: 24, so_can_co_chu: 5, so_cho_duyet: 3,
  so_bieu_phi: 5, so_sla: 8, so_nhan_su: 2, so_noi_quy: 6,
  so_hoa_don_ky_nay: 24, so_hoa_don_da_phat: 18,
}

export type YeuCauChuHo = {
  membership_id: string; unit_code: string; building_code: string
  ho_ten: string; dien_thoai: string | null; email: string | null; xin_luc: string
}

export const CHO_DUYET_CHU_HO: YeuCauChuHo[] = [
  { membership_id: 'mb-1', unit_code: 'P1-09.03', building_code: 'P1',
    ho_ten: 'Trần Thị Bích Ngọc', dien_thoai: '0912004455', email: 'ngoc.tran@example.vn',
    xin_luc: ngayGio(0, 1) },
  { membership_id: 'mb-2', unit_code: 'P2-06.06', building_code: 'P2',
    ho_ten: 'Lê Quang Vinh', dien_thoai: '0987112233', email: null,
    xin_luc: ngayGio(0, 3) },
  { membership_id: 'mb-3', unit_code: 'P2-08.05', building_code: 'P2',
    ho_ten: 'Phạm Hoàng Nam', dien_thoai: null, email: 'nam.pham@example.vn',
    xin_luc: ngayGio(1, 8) },
]

export type NguoiDungDemo = {
  user_id: string
  ho_ten: string
  email: string | null
  phone: string | null
  vai_tro_bql: string[] | null
  can_ho: string[] | null
  tao_luc: string
}

// Nhân sự xếp trước, cư dân xếp sau — đúng thứ tự bql_danh_sach_nguoi_dung trả về.
export const NGUOI_DUNG: NguoiDungDemo[] = [
  { user_id: 'nd-1', ho_ten: 'Ngô Mạnh Hà', email: 'ha.ngo@example.vn', phone: '0901234567',
    vai_tro_bql: ['bql_manager', 'bqt'], can_ho: null, tao_luc: ngayGio(96, 0) },
  { user_id: 'nd-2', ho_ten: 'Đỗ Văn Thắng', email: null, phone: '0938776655',
    vai_tro_bql: ['bql_staff'], can_ho: null, tao_luc: ngayGio(72, 0) },
  { user_id: 'nd-3', ho_ten: 'Nguyễn Văn Cường', email: null, phone: '0977001122',
    vai_tro_bql: ['security'], can_ho: null, tao_luc: ngayGio(60, 0) },
  { user_id: 'nd-4', ho_ten: 'Vũ Đình Kỹ', email: 'ky.vu@example.vn', phone: '0966554433',
    vai_tro_bql: ['technician'], can_ho: null, tao_luc: ngayGio(60, 0) },
  { user_id: 'nd-5', ho_ten: 'Trần Thị Bích Ngọc', email: 'ngoc.tran@example.vn', phone: '0912004455',
    vai_tro_bql: null, can_ho: ['P1-09.03 (owner)'], tao_luc: ngayGio(30, 0) },
  { user_id: 'nd-6', ho_ten: 'Lê Quang Vinh', email: null, phone: '0987112233',
    vai_tro_bql: null, can_ho: ['P2-06.06 (owner)'], tao_luc: ngayGio(24, 0) },
  { user_id: 'nd-7', ho_ten: 'Phạm Hoàng Nam', email: 'nam.pham@example.vn', phone: null,
    vai_tro_bql: null, can_ho: ['P2-08.05 (owner)', 'P3-02.01 (tenant)'], tao_luc: ngayGio(12, 0) },
]

export const CAN_CHUA_CO_CHU = [
  { id: 'ct-1', nhan: 'P1-12.04' },
  { id: 'ct-2', nhan: 'P2-03.07' },
  { id: 'ct-3', nhan: 'P3-15.02' },
]

export type BieuPhiDemo = {
  id: string
  code: string
  name: string
  unit_price: number | null
  calc_method: string
}

// Giá lấy quanh mức thường gặp ở chung cư Hà Nội/TP.HCM 2026 — đủ thật để nhìn
// ra thành tiền có hợp lý không, nhưng vẫn là số bịa của bản demo.
export const BIEU_PHI: BieuPhiDemo[] = [
  { id: 'bp-1', code: 'QL',   name: 'Phí quản lý',        unit_price: 16500,  calc_method: 'per_m2' },
  { id: 'bp-2', code: 'NUOC', name: 'Nước sinh hoạt',     unit_price: 8500,   calc_method: 'metered' },
  { id: 'bp-3', code: 'XEMAY',name: 'Gửi xe máy',         unit_price: 90000,  calc_method: 'fixed' },
  { id: 'bp-4', code: 'OTO',  name: 'Gửi ô tô',           unit_price: 1200000,calc_method: 'fixed' },
  { id: 'bp-5', code: 'RAC',  name: 'Vệ sinh, thu gom rác', unit_price: 30000, calc_method: 'fixed' },
]

export type SlaDemo = {
  id: string
  category: string
  priority: string
  respond_mins: number
  resolve_mins: number
  escalate_to: string
}

// Hạn lấy quanh mức các khu vận hành tốt hay cam kết. Vẫn là số của bản demo —
// hạn thật phải BQL ngồi chốt, vì đây là lời hứa với cư dân.
export const SLA: SlaDemo[] = [
  { id: 'sla-1', category: 'Thang máy', priority: 'urgent', respond_mins: 5, resolve_mins: 30, escalate_to: 'bql_manager' },
  { id: 'sla-2', category: 'Thang máy', priority: 'normal', respond_mins: 30, resolve_mins: 240, escalate_to: 'technician' },
  { id: 'sla-3', category: 'Mất nước', priority: 'high', respond_mins: 15, resolve_mins: 120, escalate_to: 'bql_manager' },
  { id: 'sla-4', category: 'Điện, chiếu sáng', priority: 'normal', respond_mins: 60, resolve_mins: 480, escalate_to: 'technician' },
  { id: 'sla-5', category: 'Điện, chiếu sáng', priority: 'low', respond_mins: 240, resolve_mins: 4320, escalate_to: 'technician' },
  { id: 'sla-6', category: 'Vệ sinh', priority: 'normal', respond_mins: 120, resolve_mins: 1440, escalate_to: 'bql_staff' },
  { id: 'sla-7', category: 'An ninh', priority: 'urgent', respond_mins: 3, resolve_mins: 60, escalate_to: 'security' },
]

export const SO_TICKET_THEO_DANH_MUC: Record<string, number> = {
  'Thang máy': 14, 'Mất nước': 6, 'Điện, chiếu sáng': 23, 'Vệ sinh': 9, 'An ninh': 2,
}
