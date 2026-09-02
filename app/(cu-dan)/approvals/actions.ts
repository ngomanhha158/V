'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export async function decide(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const approve = formData.get('approve') === '1'
  const validTo = String(formData.get('valid_to') ?? '') || null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !id) return

  // RLS (is_unit_manager) quyết định được phép hay không — không tự check ở đây,
  // để tránh hai nguồn sự thật về quyền.
  const { error } = await supabase
    .from('unit_memberships')
    .update({
      status: approve ? 'active' : 'revoked',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      ...(approve && validTo ? { valid_to: validTo } : {}),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/approvals')
}
