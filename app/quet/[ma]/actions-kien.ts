'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type TraoState = { error?: string; ok?: string }

/**
 * Trao kiện cho người vừa quét thẻ.
 *
 * `p_nguoi` là uuid ĐỌC TỪ THẺ, không phải từ ô nhập nào. Hàm SQL còn kiểm lại
 * người đó có đang ở đúng căn của kiện không — nên kể cả có ai sửa form cũng
 * không trao được hàng sang căn khác.
 */
export async function traoKien(_prev: TraoState, formData: FormData): Promise<TraoState> {
  const kien = String(formData.get('kien') ?? '')
  const nguoi = String(formData.get('nguoi') ?? '')
  if (!kien || !nguoi) return { error: 'Thiếu kiện hoặc thiếu người nhận.' }

  const db = await createClient()
  const { data, error } = await db.rpc('giao_kien_hang', { p_kien: kien, p_nguoi: nguoi })
  if (error) {
    if (error.code === '42501') {
      return { error: 'Thẻ này không thuộc căn có kiện hàng, hoặc bạn không phải nhân sự của dự án.' }
    }
    if (error.code === '23505') return { error: 'Kiện này vừa được trao rồi.' }
    if (error.code === '23514') return { error: 'Kiện này đã bị hủy.' }
    return { error: `Không trao được: ${error.message}` }
  }

  revalidatePath('/bql/kien-hang')
  revalidatePath('/hang')
  const ten = (data as { ten?: string } | null)?.ten
  return { ok: `Đã trao cho ${ten ?? 'người vừa quét thẻ'}. Sổ ghi lại đúng tên này.` }
}
