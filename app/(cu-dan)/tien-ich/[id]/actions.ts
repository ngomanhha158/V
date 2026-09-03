'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type DatState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '23505') {
    return 'Có căn khác vừa đặt suất này trước bạn. Mở lại lịch để xem còn ô nào.'
  }
  if (code === '42501') return 'Chỉ cư dân của một căn hộ mới đặt được tiện ích.'
  if (code === '42883' || code === '42P01') {
    return 'Phần tiện ích chưa có trên database. Báo ban quản lý.'
  }
  return msg
}

export async function datSuat(_prev: DatState, formData: FormData): Promise<DatState> {
  const suat = String(formData.get('suat') ?? '')
  const ngay = String(formData.get('ngay') ?? '')
  if (!suat || !ngay) return { error: 'Thiếu suất hoặc ngày.' }

  const db = await createClient()
  const { error } = await db.rpc('dat_suat', { p_suat: suat, p_ngay: ngay })
  if (error) {
    // 23514 ở đây có hai nguồn: hết hạn mức tuần, hoặc tiện ích đang đóng.
    // Thông điệp của SQL đã nói rõ nguồn nào nên chuyển thẳng ra, đừng viết đè
    // bằng một câu chung chung.
    if (error.code === '23514') return { error: error.message }
    return { error: dichLoi(error.code, `Không đặt được: ${error.message}`) }
  }

  revalidatePath('/tien-ich')
  return { ok: 'Đã giữ suất. Hủy được cho tới lúc suất bắt đầu.' }
}

export async function huySuat(_prev: DatState, formData: FormData): Promise<DatState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Thiếu lượt đặt.' }

  const db = await createClient()
  const { error } = await db.rpc('huy_dat_suat', { p_id: id })
  if (error) {
    if (error.code === '23514') {
      return { error: 'Suất đã bắt đầu, không hủy được nữa.' }
    }
    if (error.code === '23505') return { error: 'Lượt này đã hủy rồi.' }
    return { error: dichLoi(error.code, `Không hủy được: ${error.message}`) }
  }

  revalidatePath('/tien-ich')
  return { ok: 'Đã hủy. Chỗ trả lại ngay cho người khác đặt.' }
}
