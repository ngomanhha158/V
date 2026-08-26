import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  new: 'Mới', assigned: 'Đã phân công', in_progress: 'Đang xử lý',
  resolved: 'Đã xong', closed: 'Đã đóng', rejected: 'Từ chối',
}
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}

export default async function Tickets() {
  const supabase = await createClient()
  // RLS lo phần lọc: chỉ ticket của căn mình, hoặc toàn dự án nếu là BQL.
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, title, category, priority, status, created_at, sla_resolve_due, resolved_at, units(code)')
    .order('created_at', { ascending: false })

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Yêu cầu của tôi</h1>
        <Link href="/tickets/new" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Báo sự cố
        </Link>
      </div>

      {!tickets?.length && <p className="opacity-70">Chưa có yêu cầu nào.</p>}

      <ul className="space-y-2">
        {tickets?.map((t) => {
          // Quá hạn = còn chưa xong mà đã qua hạn. Xong rồi thì thôi, không bêu.
          const overdue = !t.resolved_at && t.sla_resolve_due && new Date(t.sla_resolve_due) < new Date()
          return (
            <li key={t.id} className="rounded border p-3">
              <Link href={`/tickets/${t.id}`} className="font-medium underline">{t.title}</Link>
              <div className="text-sm opacity-70">
                {t.units?.code} · {t.category} · {PRIORITY_LABEL[t.priority] ?? t.priority}
                {' · '}{STATUS_LABEL[t.status] ?? t.status}
              </div>
              {overdue && <div className="mt-1 text-sm text-red-700">Quá hạn xử lý</div>}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
