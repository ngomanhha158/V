'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Constants, type Database } from '@/lib/supabase/database.types'

type Priority = Database['public']['Enums']['ticket_priority']
export type NewTicketState = { error?: string }

function parsePriority(v: string): Priority | null {
  const allowed: readonly string[] = Constants.public.Enums.ticket_priority
  return allowed.includes(v) ? (v as Priority) : null
}

export async function createTicket(_prev: NewTicketState, formData: FormData): Promise<NewTicketState> {
  const unitId = String(formData.get('unit_id') ?? '')
  const category = String(formData.get('category') ?? '').trim()
  const priority = parsePriority(String(formData.get('priority') ?? 'normal'))
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null

  if (!unitId) return { error: 'Chưa chọn căn hộ.' }
  if (!category) return { error: 'Chưa chọn danh mục sự cố.' }
  if (!priority) return { error: 'Mức ưu tiên không hợp lệ.' }
  if (!title) return { error: 'Chưa nhập tiêu đề.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Gọi RPC thay vì insert thẳng: app KHÔNG được tự tính building_id/project_id
  // (gắn sai dự án = RLS lọc sai = rò dữ liệu sang khu khác), mà hai cột đó lại
  // NOT NULL nên type sinh từ DB bắt phải gửi. create_ticket() là security
  // invoker, RLS vẫn chặn nếu căn hộ không phải của người này.
  const { data, error } = await supabase.rpc('create_ticket', {
    p_unit: unitId,
    p_category: category,
    p_priority: priority,
    p_title: title,
    ...(description ? { p_description: description } : {}),
  })

  if (error) {
    if (error.code === '42501') return { error: 'Bạn không có quyền tạo yêu cầu cho căn hộ này.' }
    return { error: `Không gửi được yêu cầu: ${error.message}` }
  }
  redirect(`/tickets/${data}`)
}
