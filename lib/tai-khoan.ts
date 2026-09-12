/**
 * Câu chữ cho lớp tự phục vụ tài khoản.
 *
 * Hàm SQL trả về MÃ trạng thái, không trả câu tiếng Việt — cùng lý do với
 * lib/auth-loi.ts: một chuỗi tiếng Việt nằm trong database là một chuỗi không
 * ai sửa được mà không sửa schema, và không test giao diện nào chạm tới.
 *
 * Mỗi câu ở đây phải nói được VIỆC PHẢI LÀM TIẾP, không chỉ nói cái gì sai.
 * "Sai mật khẩu cũ" đã đủ rõ; "thiếu liên lạc" thì không, vì người đọc vừa xoá
 * ô email không tự hiểu rằng họ đang tự khoá mình ra ngoài.
 */

import { normalizeEmail, toE164VN } from './phone.ts'

export const MA_DOI_MAT_KHAU = [
  'ok', 'chua_dang_nhap', 'qua_ngan', 'sai_mat_khau_cu',
] as const
export type MaDoiMatKhau = (typeof MA_DOI_MAT_KHAU)[number]

export const MA_DOI_LIEN_LAC = [
  'ok', 'chua_dang_nhap', 'thieu_ten', 'thieu_lien_lac',
  'trung_email', 'trung_phone', 'trung_lien_lac', 'khong_co_nguoi',
] as const
export type MaDoiLienLac = (typeof MA_DOI_LIEN_LAC)[number]

/** Giữ khớp với auth_mat_khau_toi_thieu() trong railway/03_auth.sql — có test. */
export const MAT_KHAU_TOI_THIEU = 8

const CAU: Record<string, string> = {
  chua_dang_nhap:
    'Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi thử lần nữa.',
  qua_ngan:
    `Mật khẩu mới phải từ ${MAT_KHAU_TOI_THIEU} ký tự trở lên.`,
  sai_mat_khau_cu:
    'Mật khẩu hiện tại không đúng. Nếu không nhớ, đăng xuất rồi vào lại bằng '
    + 'mã gửi qua email — lúc đó đặt mật khẩu mới không cần mật khẩu cũ.',
  thieu_ten:
    'Họ tên không được để trống.',
  thieu_lien_lac:
    'Phải giữ lại ít nhất một trong hai: email hoặc số điện thoại. Xoá cả hai '
    + 'thì không còn đường nào để đăng nhập lại.',
  trung_email:
    'Email này đã thuộc về một tài khoản khác.',
  trung_phone:
    'Số điện thoại này đã thuộc về một tài khoản khác.',
  trung_lien_lac:
    'Email hoặc số điện thoại vừa bị một tài khoản khác lấy mất. Thử lại.',
  khong_co_nguoi:
    'Không tìm thấy tài khoản này. Có thể vừa bị xoá.',
}

/**
 * Mã lạ KHÔNG được rơi vào một câu chung chung.
 *
 * Thêm một nhánh return trong SQL mà quên thêm câu ở đây thì người dùng nhận
 * "Có lỗi xảy ra" — đúng kiểu thông điệp khiến người đi sửa mất nửa buổi tìm
 * nhầm chỗ, mà cả hệ thống này đang đi dọn. Nói thẳng cả mã ra để dòng đầu
 * tiên của việc điều tra là một từ khoá tìm được trong repo.
 */
export function cauTaiKhoan(ma: string): string {
  return CAU[ma] ?? `Máy chủ trả về trạng thái không rõ: "${ma}".`
}

/** Lý do KHÔNG gửi được, hoặc null nếu gửi được. Kiểm ở client trước khi gọi
 *  server — không phải để thay chốt chặn, mà để người dùng không phải chờ một
 *  vòng mạng chỉ để biết hai ô mật khẩu gõ lệch nhau. */
export function loiDoiMatKhau(moi: string, lapLai: string): string | null {
  if (moi.length < MAT_KHAU_TOI_THIEU) return cauTaiKhoan('qua_ngan')
  if (moi !== lapLai) return 'Hai ô mật khẩu mới chưa giống nhau.'
  return null
}

export function loiDoiLienLac(hoTen: string, email: string, phone: string): string | null {
  if (!hoTen.trim()) return cauTaiKhoan('thieu_ten')
  if (!email.trim() && !phone.trim()) return cauTaiKhoan('thieu_lien_lac')
  // Dùng LẠI normalizeEmail/toE164VN của lib/phone.ts, không viết luật thứ hai.
  // Màn tạo tài khoản của ban quản lý đã chuẩn hoá bằng đúng hai hàm đó; một
  // biểu thức chính quy thứ hai ở đây là hai luật cho cùng một câu hỏi, và
  // chúng sẽ lệch nhau — lệch nghĩa là địa chỉ tạo được ở màn này lại bị màn
  // kia từ chối.
  if (email.trim() && normalizeEmail(email) === null) {
    return 'Địa chỉ email trông chưa đúng dạng.'
  }
  if (phone.trim() && toE164VN(phone) === null) {
    return 'Số điện thoại trông chưa đúng dạng.'
  }
  return null
}

/** Chuẩn hoá đúng một lần, ngay trước khi gửi xuống database. Hàm SQL chỉ
 *  btrim và lower — nó không biết luật số Việt Nam, và không nên biết. */
export function chuanHoaLienLac(email: string, phone: string) {
  return {
    email: email.trim() ? normalizeEmail(email) : null,
    phone: phone.trim() ? toE164VN(phone) : null,
  }
}
