'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { Constants, type Database } from '@/lib/db/database.types'

type Status = Database['public']['Enums']['ticket_status']
type TicketUpdate = Database['public']['Tables']['tickets']['Update']

function parseStatus(v: string): Status | null {
  const allowed: readonly string[] = Constants.public.Enums.ticket_status
  return allowed.includes(v) ? (v as Status) : null
}

// Không tự kiểm tra is_staff ở đây. Policy ticket_staff_write là nơi duy nhất
// quyết định — cư dân không có policy update nên update của họ khớp 0 dòng.
export async function dispatchTicket(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return

  const patch: TicketUpdate = {}
  const status = parseStatus(String(formData.get('status') ?? ''))
  if (status) patch.status = status

  const assignee = String(formData.get('assignee_id') ?? '')
  // Chuỗi rỗng = bỏ phân công, khác với "không đụng tới".
  if (formData.has('assignee_id')) patch.assignee_id = assignee || null

  if (Object.keys(patch).length === 0) return

  const db = await createClient()
  await db.from('tickets').update(patch).eq('id', id)
  revalidatePath('/bql/tickets')
}
