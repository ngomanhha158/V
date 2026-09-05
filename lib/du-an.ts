import { cookies } from 'next/headers'
import { createClient } from '@/lib/db/server'
import { khuDaChon, type Khu } from '@/lib/khu'

/**
 * "Khu đang xem" của màn ban quản lý.
 *
 * Trước đây mọi màn BQL đều làm một việc giống nhau:
 *
 *     db.from('projects').select('id, name').limit(1).maybeSingle()
 *
 * Với một khu thì nó chạy đúng. Với khu thứ hai thì mỗi màn hiện dữ liệu của
 * khu nào là tùy vào thứ tự Postgres trả về — tức là tùy may rủi, và hai màn
 * mở cạnh nhau có thể nói về hai khu khác nhau mà không có gì báo.
 *
 * Ở đây lựa chọn là MỘT THỨ CÓ THẬT: lưu trong cookie, kiểm lại ở database mỗi
 * lần đọc, và rơi về khu đầu tiên nếu lựa chọn đó không còn hợp lệ.
 */

export const TEN_COOKIE_KHU = 'vb_khu'

export type { Khu } from '@/lib/khu'

/**
 * Khu đang xem + danh sách khu chọn được.
 *
 * `dang` là null khi người này không quản lý khu nào — mọi màn BQL đã có sẵn
 * nhánh "Chưa có dự án nào" cho ca đó.
 *
 * `loi` TÁCH RIÊNG khỏi danh sách rỗng. Nuốt lỗi rồi trả mảng rỗng thì một lần
 * database không với tới được sẽ hiện ra thành "bạn chưa được phân công khu
 * nào" — người trực ban đi hỏi xin lại quyền mà họ vẫn đang có. Chuyện này bắt
 * được lúc chạy thử: tắt PostgREST thì màn hình nói đúng câu đó.
 */
export async function khuDangXem(): Promise<{ dang: Khu | null; ds: Khu[]; loi: string | null }> {
  const db = await createClient()
  const { data, error } = await db.rpc('du_an_cua_toi')
  const ds = (data ?? []) as Khu[]
  const luu = (await cookies()).get(TEN_COOKIE_KHU)?.value
  return { dang: khuDaChon(ds, luu), ds, loi: error?.message ?? null }
}

/** Chỉ cần id — dạng gọn cho phần lớn màn hình. */
export async function duAnBQL(): Promise<{ id: string; name: string } | null> {
  const { dang } = await khuDangXem()
  return dang ? { id: dang.id, name: dang.name } : null
}

export function tuyChonCookieKhu() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Một năm: đây là một lựa chọn giao diện, không phải một khóa. Hết hạn sớm
    // thì người trực ban phải chọn lại khu mỗi tuần mà chẳng vì lý do gì.
    maxAge: 365 * 24 * 60 * 60,
  }
}
