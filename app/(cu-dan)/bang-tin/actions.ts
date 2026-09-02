'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type GopYState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '22023') {
    return 'Cuộc thăm dò đã đóng, hoặc lựa chọn không còn tồn tại. Tải lại trang để xem trạng thái mới.'
  }
  if (code === '42501') return 'Bạn không bỏ phiếu thay căn hộ khác được.'
  if (code === 'P0002') return 'Cuộc thăm dò này không còn nữa.'
  if (code === '42P01') {
    return 'Phần bình luận và thăm dò chưa có trên database. Chạy lại schema.sql.'
  }
  if (code === '23514') return 'Bình luận phải có nội dung và không quá 2000 ký tự.'
  return msg
}

export async function boPhieu(_prev: GopYState, formData: FormData): Promise<GopYState> {
  const poll = String(formData.get('poll') ?? '')
  const unit = String(formData.get('unit') ?? '')
  const chon = Number(formData.get('chon'))
  if (!poll || !unit) return { error: 'Thiếu thông tin bỏ phiếu.' }
  if (!Number.isInteger(chon) || chon < 0) return { error: 'Lựa chọn không hợp lệ.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('bo_phieu', {
    p_poll: poll, p_unit: unit, p_chon: chon,
  })
  if (error) return { error: dichLoi(error.code, `Không bỏ phiếu được: ${error.message}`) }

  revalidatePath('/bang-tin')
  return { ok: 'Đã ghi nhận. Đổi ý lúc nào cũng được cho tới khi cuộc thăm dò đóng.' }
}

export async function vietBinhLuan(_prev: GopYState, formData: FormData): Promise<GopYState> {
  const tb = String(formData.get('tb') ?? '')
  const unit = String(formData.get('unit') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (!tb) return { error: 'Thiếu thông báo.' }
  if (!body) return { error: 'Chưa viết gì.' }
  if (body.length > 2000) return { error: `Dài ${body.length} ký tự, tối đa 2000.` }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Phiên đăng nhập đã hết. Đăng nhập lại rồi gửi.' }

  const { error } = await supabase.from('announcement_comments').insert({
    announcement_id: tb, author_id: user.id, unit_id: unit || null, body,
  })
  if (error) return { error: dichLoi(error.code, `Không gửi được: ${error.message}`) }

  revalidatePath('/bang-tin')
  // Nói rõ là không sửa được: người ta gõ vội rồi mới đọc lại, mà biết trước
  // thì họ đọc lại TRƯỚC khi bấm gửi.
  return { ok: 'Đã gửi. Bình luận không sửa lại được — nhờ ban quản lý nếu cần gỡ.' }
}
