import { randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from './admin.ts'
import { ky } from './jwt.ts'
import { biMatJwt, PHIEN_SONG_GIAY } from './env.ts'
import { TEN_COOKIE, tuyChonCookie } from './phien.ts'
import { guiMaDangNhap } from '@/lib/mail'
import { phanLoaiLoiHeThong } from '@/lib/auth-loi'

/**
 * Toàn bộ đường đăng nhập chạy PHÍA MÁY CHỦ, dùng client service_role.
 *
 * Khác hẳn lúc còn Supabase: hồi đó màn đăng nhập gọi thẳng Supabase Auth từ
 * trình duyệt, nên rate limit phải đặt bên nhà cung cấp và app không nhìn thấy
 * gì. Giờ mọi lượt thử đều đi qua đây, đếm lượt nằm trong Postgres (chung cho
 * mọi bản sao của app), và trình duyệt không bao giờ nói chuyện với PostgREST.
 */
export type KetQua =
  | { ok: true; uid: string }
  | { ok: false; tt: string; giay?: number }
/** Sáu chữ số, kể cả khi bắt đầu bằng 0. randomInt của node:crypto chứ không
 *  phải Math.random: Math.random đoán được, và đoán được nghĩa là đăng nhập
 *  được vào tài khoản người khác. */
const sinhMa = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

/**
 * Gửi mã một lần qua email.
 *
 * Địa chỉ không có tài khoản: trả 'ok' y như lúc thành công và KHÔNG gửi gì.
 * Trả lời khác nhau ở hai trường hợp là biến màn đăng nhập thành máy dò —
 * gõ vào một danh sách email rồi xem cái nào "gửi được" là biết ai sống ở đây.
 */
export type KetQuaGuiMa =
  | 'ok' | 'cho' | 'khong_gui_duoc'
  | 'he_thong_khoa' | 'he_thong_thieu_lop' | 'he_thong_mat_ket_noi' | 'he_thong'

export async function guiMa(
  danhTinh: string, goc: string,
): Promise<{ tt: KetQuaGuiMa; giay?: number }> {
  const ma = sinhMa()
  const admin = await createAdminClient()
  const { data, error } = await admin.rpc('auth_gui_ma', { p_danh_tinh: danhTinh, p_ma: ma })
  // Cùng ba nguyên nhân với lúc kiểm mã. 'khong_gui_duoc' nói về THƯ, mà ở đây
  // thư còn chưa tới lượt — hỏng từ trước đó, ở đường ra database.
  if (error) {
    console.error('auth_gui_ma loi:', { code: error.code, message: error.message })
    return { tt: phanLoaiLoiHeThong(error) }
  }

  const hang = data?.[0]
  if (hang?.trang_thai === 'cho') return { tt: 'cho', giay: hang.cho_giay ?? 60 }
  if (hang?.trang_thai !== 'ok') return { tt: 'ok' }   // không có tài khoản — im lặng

  const q = new URLSearchParams({ dt: danhTinh, ma })
  try {
    await guiMaDangNhap(danhTinh, ma, `${goc}/auth/confirm?${q}`)
  } catch (e) {
    // Thư không đi được là lỗi hệ thống, phải nói ra. Trả 'ok' ở đây là để cư
    // dân ngồi chờ một lá thư không bao giờ đến.
    console.error('gui thu dang nhap that bai:', e)
    // Và trả lại cái suất mà mã vừa tạo đang chiếm. Không trả thì lần bấm sau
    // nhận câu "vừa gửi rồi, chờ 8 phút" — một câu trả lời SAI về nguyên nhân,
    // và nó dắt người đi sửa sang nhầm hướng đúng lúc đang có sự cố.
    await admin.rpc('auth_huy_ma', { p_danh_tinh: danhTinh })
    return { tt: 'khong_gui_duoc' }
  }
  return { tt: 'ok' }
}

export async function vaoBangMa(danhTinh: string, ma: string): Promise<KetQua> {
  const admin = await createAdminClient()
  const { data, error } = await admin.rpc('auth_kiem_ma', { p_danh_tinh: danhTinh, p_ma: ma })
  // DATABASE HỎNG KHÔNG PHẢI LÀ MÃ SAI. Trước đây chỗ này trả 'la' — người
  // dùng đọc "có lỗi không rõ, thử lại giúp em" và thử lại mãi, trong khi
  // nguyên nhân là PostgREST không với tới được hoặc AUTH_JWT_SECRET không
  // trùng PGRST_JWT_SECRET. Không ai vào được, và không câu chữ nào trên màn
  // hình chỉ về phía đó. Ghi log để còn dò, và nói thẳng cho người dùng.
  if (error) {
    console.error('auth_kiem_ma loi:', { code: error.code, message: error.message })
    return { ok: false, tt: phanLoaiLoiHeThong(error) }
  }
  const hang = data?.[0]
  if (hang?.trang_thai === 'ok' && hang.uid) return { ok: true, uid: hang.uid }
  return { ok: false, tt: hang?.trang_thai ?? 'sai' }
}

export async function vaoBangMatKhau(danhTinh: string, matKhau: string): Promise<KetQua> {
  const admin = await createAdminClient()
  const { data, error } = await admin.rpc('auth_kiem_mat_khau', {
    p_danh_tinh: danhTinh, p_mat_khau: matKhau,
  })
  // Như trên: hỏng hệ thống khác sai mật khẩu. Gộp hai thứ đó làm một là để
  // người dùng đi đổi mật khẩu trong lúc máy chủ mới là thứ đang hỏng.
  if (error) {
    console.error('auth_kiem_mat_khau loi:', { code: error.code, message: error.message })
    return { ok: false, tt: phanLoaiLoiHeThong(error) }
  }
  if (!data) return { ok: false, tt: 'sai_mat_khau' }
  return { ok: true, uid: data }
}

/** Đặt cookie phiên. Chỉ gọi được từ Route Handler — Server Component không
 *  ghi được cookie. */
export async function moPhien(uid: string): Promise<void> {
  const token = await ky(uid, 'authenticated', biMatJwt(), PHIEN_SONG_GIAY)
  ;(await cookies()).set(TEN_COOKIE, token, tuyChonCookie(PHIEN_SONG_GIAY))
}

export async function dongPhien(): Promise<void> {
  ;(await cookies()).delete(TEN_COOKIE)
}
