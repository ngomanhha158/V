/**
 * Hỏi database "người này được làm gì" — và phân biệt KHÔNG với KHÔNG HỎI ĐƯỢC.
 *
 * Mọi chốt quyền trong app đều viết một kiểu:
 *
 *     const { data: isStaff } = await db.rpc('is_staff', { p_project: id })
 *     if (!isStaff) redirect('/')
 *
 * Lỗi bị bỏ đi, nên `isStaff` là `undefined` khi PostgREST không với tới được,
 * khi schema chưa áp, khi hàm chưa được cấp quyền execute. `undefined` là giả,
 * nên người dùng bị đá về trang chủ — KHÔNG một chữ nào giải thích.
 *
 * Chặn lại thì đúng: chưa hỏi được thì không được cho qua, không bao giờ. Sai
 * là ở chỗ LẶNG LẼ. Hai chuyện khác hẳn nhau bị trộn thành một màn hình:
 *
 *   - "Bạn không phải nhân sự khu này"  → người dùng đi xin quyền.
 *   - "Không hỏi được"                  → người dùng phải đi báo hỏng.
 *
 * Trộn hai thứ đó lại thì người trực ban đi xin lại quyền họ vẫn đang có, còn
 * người dựng hệ thống nghe báo "cả BQL mất quyền" trong khi thứ hỏng là một
 * câu `grant` chưa chạy. Comment trong app/quet/page.tsx đã viết sẵn hậu quả
 * cho một nguyên nhân khác của đúng màn hình đó: "màn quét thẻ đóng lại ngay
 * giữa ca, và ở cửa thì không có ai để hỏi vì sao."
 *
 * Nên: hỏi không được thì NÉM. Vỏ bắt lỗi ở app/error.tsx nói đúng một câu —
 * sự cố nằm ở phía máy chủ, kèm mã tra được trong log Railway — và đó là câu
 * đúng. Cái sai không phải là màu đỏ; cái sai là màu đỏ giả dạng màu xám.
 *
 * File này KHÔNG import gì, để test được bằng node:test mà không cần dựng Next.
 */

/** Dạng lỗi của supabase-js, rút gọn còn phần thực sự dùng tới. */
export type LoiDb = { message: string; code?: string | null } | null | undefined

/** Một kết quả `db.rpc(...)` đã await. */
export type KetQuaRpc = { data: unknown; error: LoiDb }

export type PhanQuyet = 'cho' | 'chan' | 'khong_hoi_duoc'

/**
 * Lỗi ném ra khi câu hỏi quyền không tới được database.
 *
 * Có lớp riêng để chỗ nào cần trả JSON (route handler) bắt đúng nó mà đáp 503,
 * thay vì nuốt chung với mọi lỗi khác rồi lại trả về một con số sai nghĩa.
 */
export class KhongHoiDuocQuyen extends Error {
  readonly ten: string
  readonly chiTiet: string
  constructor(ten: string, chiTiet: string) {
    super(cauKhongHoiDuoc(ten, chiTiet))
    this.name = 'KhongHoiDuocQuyen'
    this.ten = ten
    this.chiTiet = chiTiet
  }
}

export function laKhongHoiDuocQuyen(e: unknown): e is KhongHoiDuocQuyen {
  return e instanceof KhongHoiDuocQuyen
}

/**
 * Câu ghi vào log. Ở production Next KHÔNG đưa nội dung lỗi xuống trình duyệt
 * (nó có thể chứa tên bảng, tên hàm) nhưng có ghi nguyên câu này vào log kèm
 * `digest` — nên câu phải đủ để người đọc log biết ngay phải chạy lại cái gì,
 * và phải nói rõ đây không phải một lần từ chối quyền.
 */
export function cauKhongHoiDuoc(ten: string, chiTiet: string): string {
  return `Không hỏi được quyền qua ${ten}(): ${chiTiet}. `
    + 'Đây KHÔNG phải "người này không có quyền" — câu hỏi chưa tới được database. '
    + 'Thường là schema chưa áp, chưa grant execute, hoặc PostgREST không với tới được.'
}

/**
 * Ba trạng thái, không phải hai.
 *
 * Lỗi THẮNG dữ liệu: một kết quả vừa có `error` vừa có `data` là kết quả không
 * tin được, và bên không tin được thì không được cho qua.
 *
 * Không lỗi mà `data` không phải `true` — kể cả `null`/`undefined` — thì chặn.
 * Chốt quyền chỉ mở khi database nói đúng chữ "có".
 */
export function xetQuyen(r: KetQuaRpc): PhanQuyet {
  if (r.error) return 'khong_hoi_duoc'
  return r.data === true ? 'cho' : 'chan'
}

/**
 * Chốt quyền dạng boolean: `is_staff`, `is_bqt`, `is_bql_manager`.
 *
 *     const kq = await db.rpc('is_staff', { p_project: project.id })
 *     if (!quyen(kq, 'is_staff')) redirect('/')
 *
 * Một dòng đổi lấy một dòng, nên không có lý do gì để viết kiểu cũ — và không
 * có chỗ nào để quên đọc `error`, vì hàm này không cho lấy `data` ra riêng.
 */
export function quyen(r: KetQuaRpc, ten: string): boolean {
  const p = xetQuyen(r)
  if (p === 'khong_hoi_duoc') throw new KhongHoiDuocQuyen(ten, r.error?.message ?? 'không rõ')
  return p === 'cho'
}

/**
 * Chốt quyền dạng danh sách: `du_an_cua_toi`, `current_unit_ids`, `khu_toi_o`.
 *
 * `data ?? []` là chỗ bệnh nặng nhất của họ nhà này: một lần đọc hỏng biến
 * thành "bạn không ở khu nào", "bạn không quản lý khu nào", "căn hộ này không
 * phải của bạn" — ba câu đều nói về TƯ CÁCH của người dùng, và đều sai.
 */
export function danhSach<T>(r: KetQuaRpc, ten: string): T[] {
  if (r.error) throw new KhongHoiDuocQuyen(ten, r.error.message)
  return Array.isArray(r.data) ? (r.data as T[]) : []
}
