/**
 * Nhật ký kiểm toán: đọc dòng sổ thô thành câu người đọc được.
 *
 * Thuần dữ liệu, không đụng database — màn thật và màn demo cùng dùng, và test
 * được. Sổ ghi bằng tên cột của Postgres (`unit_price`, `is_active`); bắt BQT
 * đọc thẳng tên cột là buộc họ học schema để dùng được sổ của chính mình.
 */

import { ngayGioVN, ngayVN } from './ngay.ts'

export const TEN_BANG: Record<string, string> = {
  units: 'Căn hộ',
  unit_memberships: 'Thành viên căn hộ',
  staff_assignments: 'Phân quyền nhân sự',
  fee_types: 'Biểu phí',
  sla_policies: 'Cam kết thời gian',
  invoices: 'Hóa đơn',
  invoice_lines: 'Dòng phí trong hóa đơn',
  payments: 'Khoản đã thu',
  bank_transactions: 'Sổ tiền về',
}

export const tenBang = (v: string) => TEN_BANG[v] ?? v

export const TEN_THAO_TAC: Record<string, { nhan: string; tone: 'tot' | 'canh' | 'xau' }> = {
  INSERT: { nhan: 'Tạo mới', tone: 'tot' },
  UPDATE: { nhan: 'Sửa', tone: 'canh' },
  DELETE: { nhan: 'Xóa', tone: 'xau' },
}

/**
 * Tên cột theo tiếng Việt. Gộp chung mọi bảng thay vì tách theo bảng: các cột
 * trùng tên thì cũng trùng nghĩa (`amount` ở đâu cũng là số tiền), và một bảng
 * tra duy nhất thì không có chuyện quên cập nhật một nhánh.
 */
export const TEN_COT: Record<string, string> = {
  amount: 'Số tiền',
  approved_at: 'Duyệt lúc',
  approved_by: 'Người duyệt',
  area_m2: 'Diện tích (m²)',
  bank_ref: 'Mã tham chiếu NH',
  calc_method: 'Cách tính',
  can_view_finance: 'Xem được tài chính',
  cach_khop: 'Cách khớp',
  code: 'Mã',
  con_du: 'Còn dư chưa gạch',
  content: 'Nội dung chuyển khoản',
  description: 'Diễn giải',
  due_date: 'Hạn thanh toán',
  escalate_to: 'Quá hạn báo ai',
  floor_no: 'Tầng',
  is_active: 'Đang hoạt động',
  issued_at: 'Phát hành lúc',
  kind: 'Loại',
  matched_by: 'Khớp bởi',
  method: 'Hình thức',
  name: 'Tên',
  paid_amount: 'Đã trả',
  paid_at: 'Thời điểm nộp',
  period: 'Kỳ',
  priority: 'Mức ưu tiên',
  quantity: 'Số lượng',
  raw_payload: 'Gói tin ngân hàng',
  resolve_mins: 'Hạn xử lý (phút)',
  respond_mins: 'Hạn tiếp nhận (phút)',
  role: 'Vai trò',
  state: 'Tình trạng căn',
  status: 'Trạng thái',
  total_amount: 'Tổng tiền',
  trang_thai: 'Trạng thái',
  unit_price: 'Đơn giá',
  valid_from: 'Có hiệu lực từ',
  valid_to: 'Hết hiệu lực',
}

export const tenCot = (v: string) => TEN_COT[v] ?? v

/**
 * Giá trị enum của Postgres, dịch ra tiếng người.
 *
 * Sổ ghi `chua_khop`, `bql_manager`, `issued`. Để nguyên thì BQT phải học từ
 * điển schema mới đọc được sổ của chính mình — mà sổ kiểm toán đọc không nổi
 * thì đúng bằng không có sổ.
 *
 * Gộp một bảng tra chung cho mọi cột: các giá trị này không trùng nhau giữa
 * các enum, và một bảng thì không có nhánh nào bị quên cập nhật.
 */
export const TEN_GIA_TRI: Record<string, string> = {
  // trạng thái hóa đơn
  draft: 'Nháp', issued: 'Đã phát hành', paid: 'Đã trả', void: 'Đã hủy',
  partial: 'Trả một phần', overdue: 'Quá hạn',
  // tư cách thành viên căn hộ
  pending: 'Chờ duyệt', active: 'Đang hiệu lực', rejected: 'Từ chối',
  expired: 'Hết hiệu lực', revoked: 'Đã thu hồi',
  // vai trò trong căn
  owner: 'Chủ hộ', authorized: 'Người được ủy quyền', tenant: 'Người thuê',
  family: 'Người nhà',
  // vai trò nhân sự
  bql_manager: 'Trưởng ban quản lý', bql_staff: 'Nhân viên BQL',
  technician: 'Kỹ thuật', security: 'Bảo vệ', bqt: 'Ban quản trị',
  // mức ưu tiên
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
  // loại và tình trạng căn
  apartment: 'Căn hộ', shophouse: 'Shophouse', office: 'Văn phòng',
  penthouse: 'Penthouse',
  vacant: 'Chưa có người ở', owner_occupied: 'Chủ ở', rented: 'Cho thuê',
  // sổ tiền về
  chua_khop: 'Chưa khớp', da_khop: 'Đã khớp', bo_qua: 'Bỏ qua',
  ma_can: 'Theo mã căn', thu_cong: 'Thủ công', auto: 'Tự động',
  // cách tính phí
  fixed: 'Cố định', per_m2: 'Theo m²', metered: 'Theo chỉ số',
}

/** Mốc thời gian ISO mà Postgres trả về, để nhận ra và đổi sang giờ Việt. */
const LA_MOC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** Cột chứa tiền — hiện ra phải có dấu phân nhóm, không thì 16500 với 165000 nhìn như nhau. */
const COT_TIEN = new Set([
  'amount', 'total_amount', 'paid_amount', 'unit_price', 'con_du', 'con_no',
])

/**
 * Đổi một giá trị JSON trong sổ thành chữ đọc được.
 *
 * `null` phải hiện thành "(trống)" chứ không phải chuỗi rỗng: một ô trống trong
 * bảng nhìn giống hệt "không có gì đổi", trong khi xóa giá trị đi là một thay
 * đổi có thật và thường là thay đổi đáng chú ý nhất.
 */
export function docGiaTri(cot: string, v: unknown): string {
  if (v === null || v === undefined) return '(trống)'
  if (typeof v === 'boolean') return v ? 'Có' : 'Không'
  if (typeof v === 'number' && COT_TIEN.has(cot)) return v.toLocaleString('vi-VN') + 'đ'
  if (typeof v === 'number') return v.toLocaleString('vi-VN')
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  if (s === '') return '(rỗng)'
  // Mốc thời gian thô ("2026-08-27T02:30:00.000Z") giữa một bảng tiếng Việt là
  // chỗ lộ ruột kỹ thuật rõ nhất — và nó lại còn là giờ UTC, lệch 7 tiếng.
  if (LA_MOC.test(s)) return ngayGioVN(s)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return ngayVN(s)
  if (TEN_GIA_TRI[s]) return TEN_GIA_TRI[s]
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

export type ThayDoi = { cot: string; nhan: string; truoc: string; sau: string }

/**
 * Ghép hai gói `truoc`/`sau` thành danh sách thay đổi để hiện ra bảng.
 *
 * Trigger đã chỉ ghi cột đổi, nên ở đây không lọc lại — nhưng vẫn lấy khóa từ
 * HỢP của hai bên: cột chỉ có ở một bên (tạo mới, hoặc xóa) mà bỏ qua là mất
 * đúng phần nội dung người ta cần.
 */
export function docThayDoi(truoc: unknown, sau: unknown): ThayDoi[] {
  const a = (truoc ?? {}) as Record<string, unknown>
  const b = (sau ?? {}) as Record<string, unknown>
  const khoa = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  return khoa.map((c) => ({
    cot: c,
    nhan: tenCot(c),
    truoc: docGiaTri(c, a[c] ?? null),
    sau: docGiaTri(c, b[c] ?? null),
  }))
}

/**
 * Vai trò kỹ thuật lúc ghi sổ, dịch ra tiếng người.
 *
 * `actor_id` rỗng mà không nói thêm gì thì mọi thao tác tự động trông như nhau:
 * cron tự chạy, webhook ngân hàng bắn về, và người vào SQL editor gõ tay là ba
 * chuyện rất khác nhau khi truy trách nhiệm.
 */
export function docNguoi(actorId: string | null, actorRole: string, ten?: string): string {
  if (actorId) return ten ?? actorId.slice(0, 8)
  if (actorRole === 'service_role') return 'Hệ thống (khóa máy chủ)'
  if (actorRole === 'authenticated' || actorRole === 'anon') return 'Không rõ (mất phiên)'
  return `Trực tiếp trên database (${actorRole})`
}
