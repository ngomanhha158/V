'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { TEN_COOKIE_KHU, tuyChonCookieKhu } from '@/lib/du-an'

/**
 * Đổi khu đang xem.
 *
 * Kiểm quyền Ở ĐÂY chứ không chỉ lúc đọc: ghi một id lạ vào cookie thì mọi màn
 * sẽ lặng lẽ rơi về khu mặc định, và người dùng bấm chọn khu rồi thấy vẫn khu
 * cũ mà không hiểu vì sao.
 */
export async function chonKhu(formData: FormData): Promise<void> {
  const id = String(formData.get('khu') ?? '')
  if (!id) return
  const db = await createClient()
  const { data } = await db.rpc('duoc_quan_ly', { p_project: id })
  if (data !== true) return
  ;(await cookies()).set(TEN_COOKIE_KHU, id, tuyChonCookieKhu())
  revalidatePath('/bql', 'layout')
}
