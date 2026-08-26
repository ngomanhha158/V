import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dispatchTicket } from './actions'
import { Constants } from '@/lib/supabase/database.types'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  new: 'Mới', assigned: 'Đã phân công', in_progress: 'Đang xử lý',
  resolved: 'Đã xong', closed: 'Đã đóng', rejected: 'Từ chối',
}
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}
const OPEN: string[] = ['new', 'assigned', 'in_progress']

export default async function BqlTickets({
  searchParams,
}: { searchParams: Promise<{ status?: string; building?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <main><p>Chưa có dự án nào.</p></main>
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  let q = supabase
    .from('tickets')
    .select('id, title, category, priority, status, created_at, sla_resolve_due, resolved_at, escalated_at, assignee_id, units(code, building_id, buildings(code, name)), profiles!tickets_reporter_id_fkey(full_name, phone)')
    .order('created_at', { ascending: false })

  // Mặc định chỉ hiện việc CHƯA xong: bảng điều phối mà mở ra thấy 500 ticket
  // đã đóng thì không ai dùng.
  if (sp.status === 'all') { /* không lọc */ }
  else if (sp.status) q = q.eq('status', sp.status as never)
  else q = q.in('status', OPEN as never[])

  const [{ data: tickets, error }, { data: buildings }, { data: staff }] = await Promise.all([
    q,
    supabase.from('buildings').select('id, code, name').order('code'),
    supabase
      .from('staff_assignments')
      .select('user_id, role, profiles(full_name)')
      .eq('is_active', true),
  ])

  const filtered = sp.building
    ? (tickets ?? []).filter((t) => t.units?.building_id === sp.building)
    : (tickets ?? [])

  const now = Date.now()

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Điều phối yêu cầu</h1>
        <Link href="/bql" className="text-sm underline">Quản lý tòa</Link>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/bql/tickets" className="rounded border px-3 py-1">Chưa xong</Link>
        {Constants.public.Enums.ticket_status.map((st) => (
          <Link key={st} href={`/bql/tickets?status=${st}`} className="rounded border px-3 py-1">
            {STATUS_LABEL[st]}
          </Link>
        ))}
        <Link href="/bql/tickets?status=all" className="rounded border px-3 py-1">Tất cả</Link>
      </nav>

      {buildings && buildings.length > 1 && (
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href={`/bql/tickets${sp.status ? `?status=${sp.status}` : ''}`} className="rounded border px-3 py-1">
            Mọi tòa
          </Link>
          {buildings.map((b) => (
            <Link
              key={b.id}
              href={`/bql/tickets?building=${b.id}${sp.status ? `&status=${sp.status}` : ''}`}
              className="rounded border px-3 py-1"
            >
              {b.code}
            </Link>
          ))}
        </nav>
      )}

      {error && (
        <p className="rounded bg-red-100 p-3 text-sm text-red-900">Không đọc được danh sách: {error.message}</p>
      )}
      {!error && filtered.length === 0 && <p className="opacity-70">Không có yêu cầu nào.</p>}

      <ul className="space-y-3">
        {filtered.map((t) => {
          const overdue = !t.resolved_at && t.sla_resolve_due && new Date(t.sla_resolve_due).getTime() < now
          return (
            <li key={t.id} className={`rounded border p-3 ${overdue ? 'border-red-400' : ''}`}>
              <div className="flex flex-wrap items-baseline gap-2">
                <Link href={`/tickets/${t.id}`} className="font-medium underline">{t.title}</Link>
                <span className="text-sm opacity-70">
                  {t.units?.buildings?.code} · {t.units?.code} · {t.category} · {PRIORITY_LABEL[t.priority]}
                </span>
              </div>
              <div className="text-sm opacity-70">
                Người báo: {t.profiles?.full_name ?? '—'}
                {t.profiles?.phone && ` · ${t.profiles.phone}`}
              </div>
              {overdue && (
                <div className="mt-1 text-sm text-red-700">
                  Quá hạn SLA{t.escalated_at && ' · đã leo thang'}
                </div>
              )}

              <form action={dispatchTicket} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={t.id} />
                <select name="status" defaultValue={t.status} className="rounded border p-1 text-sm">
                  {Constants.public.Enums.ticket_status.map((st) => (
                    <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                  ))}
                </select>
                <select name="assignee_id" defaultValue={t.assignee_id ?? ''} className="rounded border p-1 text-sm">
                  <option value="">— Chưa phân công —</option>
                  {staff?.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.profiles?.full_name ?? s.user_id.slice(0, 8)} ({s.role})
                    </option>
                  ))}
                </select>
                <button className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">Lưu</button>
              </form>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
