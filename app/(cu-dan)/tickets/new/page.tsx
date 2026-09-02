import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { NewTicketForm } from './form'
import { Card, LinkButton, PageHead, Trong } from '@/components/ui'
import { IcTrai } from '@/components/icons'

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
      <div className="space-y-5">
        <PageHead title="Báo sự cố" />
        <Trong
          title="Bạn chưa gắn với căn hộ nào"
          action={<LinkButton href="/onboarding" dang="chinh" co="sm">Xin gia nhập căn hộ</LinkButton>}
        >
          Phải là thành viên của một căn hộ thì mới gửi được yêu cầu, để BQL biết
          sự cố xảy ra ở đâu.
        </Trong>
      </div>
    )
  }

  // Danh mục lấy từ sla_policies: chỉ cho chọn thứ đã có hạn SLA, để không tạo
  // ra ticket không ai đo được. Danh mục lạ vẫn tạo được qua API (schema cho
  // phép, hạn để NULL) — chỉ là giao diện không mời.
  const { data: policies } = await supabase.from('sla_policies').select('category')
  const categories = [...new Set((policies ?? []).map((p) => p.category))].sort()

  return (
    <div className="space-y-5">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
      >
        <IcTrai width={16} height={16} /> Yêu cầu của tôi
      </Link>
      <PageHead
        title="Báo sự cố"
        sub="BQL nhận ngay và chạy theo cam kết thời gian của danh mục bạn chọn"
      />
      <Card>
        <div className="p-4">
          <NewTicketForm units={units} categories={categories} />
        </div>
      </Card>
    </div>
  )
}
