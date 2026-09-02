import { randomInt } from 'node:crypto'
import { cookies } from 'next/headers'
import { createAdminClient } from './admin'
import { ky } from './jwt'
import { biMatJwt, PHIEN_SONG_GIAY } from './env'
import { TEN_COOKIE, tuyChonCookie } from './phien'
import { guiMaDangNhap } from '@/lib/mail'

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
export async function guiMa(
  danhTinh: string, goc: string,
): Promise<{ tt: 'ok' | 'cho' | 'khong_gui_duoc'; giay?: number }> {
  const ma = sinhMa()
  const admin = await createAdminClient()
  const { data, error } = await admin.rpc('auth_gui_ma', { p_danh_tinh: danhTinh, p_ma: ma })
  if (error) return { tt: 'khong_gui_duoc' }

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
    return { tt: 'khong_gui_duoc' }
  }
  return { tt: 'ok' }
}

export async function vaoBangMa(danhTinh: string, ma: string): Promise<KetQua> {
  const admin = await createAdminClient()
  const { data, error } = await admin.rpc('auth_kiem_ma', { p_danh_tinh: danhTinh, p_ma: ma })
  if (error) return { ok: false, tt: 'la' }
  const hang = data?.[0]
  if (hang?.trang_thai === 'ok' && hang.uid) return { ok: true, uid: hang.uid }
  return { ok: false, tt: hang?.trang_thai ?? 'sai' }
}

export async function vaoBangMatKhau(danhTinh: string, matKhau: string): Promise<KetQua> {
  const admin = await createAdminClient()
  const { data, error } = await admin.rpc('auth_kiem_mat_khau', {
    p_danh_tinh: danhTinh, p_mat_khau: matKhau,
  })
  if (error) return { ok: false, tt: 'la' }
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
