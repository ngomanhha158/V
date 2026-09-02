'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { Constants, type Database } from '@/lib/db/database.types'

type UnitRole = Database['public']['Enums']['unit_role']

// Đối chiếu với enum sinh từ DB: thêm vai trò mới trong schema là chỗ này tự có.
function parseRole(value: string): UnitRole | null {
  const allowed: readonly string[] = Constants.public.Enums.unit_role
  return allowed.includes(value) ? (value as UnitRole) : null
}

export async function requestJoin(formData: FormData) {
  const unitId = String(formData.get('unit_id') ?? '')
  const role = parseRole(String(formData.get('role') ?? ''))
  if (!unitId || !role) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Chỉ tạo yêu cầu 'pending'. RLS chặn tự đặt 'active' — chủ hộ mới duyệt được.
  const { error } = await supabase.from('unit_memberships').insert({
    unit_id: unitId, user_id: user.id, role, status: 'pending',
  })
  if (error) throw new Error(error.message)

  revalidatePath('/')
  redirect('/')
}
