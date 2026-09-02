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
