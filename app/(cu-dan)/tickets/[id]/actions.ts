'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type RateState = { error?: string; ok?: string }

export async function rateTicket(ticketId: string, _prev: RateState, formData: FormData): Promise<RateState> {
  const rating = Number(formData.get('rating') ?? 0)
  const note = String(formData.get('rating_note') ?? '').trim()
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: 'Chọn số sao từ 1 đến 5.' }
  }

  const supabase = await createClient()
  // rate_ticket tự kiểm tra quyền bên trong (nó là definer, bỏ qua RLS).
  const { error } = await supabase.rpc('rate_ticket', {
    p_ticket: ticketId,
    p_rating: rating,
    ...(note ? { p_note: note } : {}),
  })

  if (error) {
    if (error.code === '42501') return { error: 'Bạn không thuộc căn hộ của yêu cầu này.' }
    if (error.code === '55000') return { error: 'Chỉ đánh giá được khi yêu cầu đã xong.' }
    return { error: `Không gửi được đánh giá: ${error.message}` }
  }

  revalidatePath(`/tickets/${ticketId}`)
  return { ok: 'Cảm ơn bạn đã đánh giá.' }
}
