'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export async function danhDauDaDoc() {
  const db = await createClient()
  // RPC chứ không update thẳng: xem chú thích ở mark_notifications_read trong
  // schema.sql — cấp update cả dòng là cho người ta sửa được nội dung thông báo
  // của chính mình.
  await db.rpc('mark_notifications_read', {})
  revalidatePath('/thong-bao')
}

/** Ghi đăng ký push của một máy. Server action chứ không route: nó cần phiên
 *  đăng nhập, và RPC tự gắn auth.uid() nên trình duyệt không truyền được
 *  user_id của người khác. */
export async function dangKyPush(
  endpoint: string, p256dh: string, auth: string, may: string,
): Promise<{ ok: boolean; loi?: string }> {
  const db = await createClient()
  const { error } = await db.rpc('push_dang_ky_may', {
    p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_may: may,
  })
  if (error) return { ok: false, loi: error.message }
  revalidatePath('/thong-bao')
  return { ok: true }
}

/** Gỡ một máy. RLS chỉ cho gỡ máy của chính mình. */
export async function goPush(endpoint: string): Promise<{ ok: boolean; loi?: string }> {
  const db = await createClient()
  const { error } = await db.rpc('push_go_may', { p_endpoint: endpoint })
  if (error) return { ok: false, loi: error.message }
  revalidatePath('/thong-bao')
  return { ok: true }
}
