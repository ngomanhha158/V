'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { KHU_DEMO } from '@/lib/demo/data'
import { TEN_COOKIE_KHU_DEMO } from './khu-dang-xem'

/**
 * Đổi khu trong bản demo.
 *
 * Vẫn kiểm lại id trước khi ghi — đúng như bản thật. Bản demo không có dữ liệu
 * để rò rỉ, nhưng nếu ở đây tin cookie còn ở kia thì không, hai bản sẽ dạy hai
 * thói quen khác nhau cho người đọc code.
 */
export async function chonKhuDemo(formData: FormData): Promise<void> {
  const id = String(formData.get('khu') ?? '')
  if (!KHU_DEMO.some((k) => k.id === id)) return
  ;(await cookies()).set(TEN_COOKIE_KHU_DEMO, id, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60,
  })
  revalidatePath('/demo/bql', 'layout')
}
