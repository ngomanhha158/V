import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NewTicketForm } from './form'

export const dynamic = 'force-dynamic'

export default async function NewTicket() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: memberships } = await supabase
    .from('unit_memberships')
    .select('units(id, code)')
    .eq('user_id', user?.id ?? '')
    .eq('status', 'active')

  const units = (memberships ?? [])
    .map((m) => m.units)
    .filter((u): u is { id: string; code: string } => !!u)

  if (units.length === 0) {
    return (
      <main className="space-y-3">
        <h1 className="text-2xl font-semibold">Báo sự cố</h1>
        <p>Bạn chưa gắn với căn hộ nào. <Link href="/onboarding" className="underline">Xin gia nhập căn hộ</Link>.</p>
      </main>
    )
  }

  // Danh mục lấy từ sla_policies: chỉ cho chọn thứ đã có hạn SLA, để không tạo
  // ra ticket không ai đo được. Danh mục lạ vẫn tạo được qua API (schema cho
  // phép, hạn để NULL) — chỉ là giao diện không mời.
  const { data: policies } = await supabase.from('sla_policies').select('category')
  const categories = [...new Set((policies ?? []).map((p) => p.category))].sort()

  return (
    <main className="space-y-4">
      <Link href="/tickets" className="text-sm underline">← Yêu cầu của tôi</Link>
      <h1 className="text-2xl font-semibold">Báo sự cố</h1>
      <NewTicketForm units={units} categories={categories} />
    </main>
  )
}
