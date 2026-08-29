import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dispatchTicket } from './actions'
import { Constants } from '@/lib/supabase/database.types'
import {
  Button, Card, CardHead, Chip, Hop, PageHead, Pill, Select, Stat, Trong, cx, ngayVN,
} from '@/components/ui'
import { IcNguoi } from '@/components/icons'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  new: 'Mới', assigned: 'Đã phân công', in_progress: 'Đang xử lý',
  resolved: 'Đã xong', closed: 'Đã đóng', rejected: 'Từ chối',
}
const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}
const TT_TONE: Record<string, 'trung' | 'canh' | 'brand' | 'tot' | 'xau'> = {
  new: 'brand', assigned: 'brand', in_progress: 'canh',
  resolved: 'tot', closed: 'trung', rejected: 'xau',
}
const UU_TONE: Record<string, 'trung' | 'canh' | 'xau'> = {
  low: 'trung', normal: 'trung', high: 'canh', urgent: 'xau',
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

  const tre = (t: (typeof filtered)[number]) =>
    !t.resolved_at && !!t.sla_resolve_due && new Date(t.sla_resolve_due).getTime() < now

  // Quá hạn lên đầu: màn điều phối phải bày ra việc đang cháy, không xếp theo
  // ngày tạo rồi bắt người trực tự dò.
  const sap = [...filtered].sort((a, b) => Number(tre(b)) - Number(tre(a)))
  const quaHan = filtered.filter(tre)
  const chuaGiao = filtered.filter((t) => !t.assignee_id && !t.resolved_at)
  const qs = sp.status ? `?status=${sp.status}` : ''

  return (
    <div className="space-y-5">
      <PageHead title="Điều phối yêu cầu" sub={project.name} />

      <div className="grid grid-cols-3 gap-3">
        <Stat nhan="Đang hiện" so={filtered.length} />
        <Stat nhan="Quá hạn SLA" so={quaHan.length} tone={quaHan.length ? 'xau' : 'tot'} />
        <Stat nhan="Chưa phân công" so={chuaGiao.length} tone={chuaGiao.length ? 'canh' : 'tot'} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Chip href="/bql/tickets" active={!sp.status}>Chưa xong</Chip>
          {Constants.public.Enums.ticket_status.map((st) => (
            <Chip key={st} href={`/bql/tickets?status=${st}`} active={sp.status === st}>
              {STATUS_LABEL[st]}
            </Chip>
          ))}
          <Chip href="/bql/tickets?status=all" active={sp.status === 'all'}>Tất cả</Chip>
        </div>

        {buildings && buildings.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Chip href={`/bql/tickets${qs}`} active={!sp.building}>Mọi tòa</Chip>
            {buildings.map((b) => (
              <Chip
                key={b.id}
                href={`/bql/tickets?building=${b.id}${sp.status ? `&status=${sp.status}` : ''}`}
                active={sp.building === b.id}
              >
                {b.code}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {error && <Hop tone="xau" title="Không đọc được danh sách">{error.message}</Hop>}

      {!error && sap.length === 0 ? (
        <Trong title="Không có yêu cầu nào">
          Không có yêu cầu nào khớp bộ lọc hiện tại.
        </Trong>
      ) : (
        <Card>
          <CardHead
            title="Danh sách yêu cầu"
            right={<span className="text-[0.8125rem] text-faint">{sap.length}</span>}
          />
          <ul className="divide-y divide-line">
            {sap.map((t) => {
              const overdue = tre(t)
              return (
                <li
                  key={t.id}
                  className={cx('px-4 py-4 transition-colors hover:bg-raised', overdue && 'bg-bad-soft/40')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/tickets/${t.id}`}
                        className="text-sm font-semibold text-ink hover:underline"
                      >
                        {t.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Pill tone={TT_TONE[t.status] ?? 'trung'}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Pill>
                        {UU_TONE[t.priority] !== 'trung' && (
                          <Pill tone={UU_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Pill>
                        )}
                        {overdue && (
                          <Pill tone="xau">
                            Quá hạn SLA{t.escalated_at && ' · đã leo thang'}
                          </Pill>
                        )}
                        <Pill tone="trung" cham={false}>{t.category}</Pill>
                      </div>
                      <div className="mt-2 text-[0.8125rem] text-muted">
                        <span className="font-medium text-ink">
                          {t.units?.buildings?.code} · {t.units?.code}
                        </span>
                        {' · '}{t.profiles?.full_name ?? '—'}
                        {t.profiles?.phone && (
                          <>
                            {' · '}
                            <a href={`tel:${t.profiles.phone}`} className="num text-brand hover:underline">
                              {t.profiles.phone}
                            </a>
                          </>
                        )}
                        {t.sla_resolve_due && (
                          <>
                            {' · hạn '}
                            <span className={cx('num', overdue && 'font-medium text-bad')}>
                              {ngayVN(String(t.sla_resolve_due))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <form
                    action={dispatchTicket}
                    className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3"
                  >
                    <input type="hidden" name="id" value={t.id} />
                    <Select name="status" defaultValue={t.status} className="h-8 w-auto text-[0.8125rem]">
                      {Constants.public.Enums.ticket_status.map((st) => (
                        <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                      ))}
                    </Select>
                    <Select
                      name="assignee_id" defaultValue={t.assignee_id ?? ''}
                      className="h-8 w-auto text-[0.8125rem]"
                    >
                      <option value="">— Chưa phân công —</option>
                      {staff?.map((s) => (
                        <option key={s.user_id} value={s.user_id}>
                          {s.profiles?.full_name ?? s.user_id.slice(0, 8)} ({s.role})
                        </option>
                      ))}
                    </Select>
                    <Button co="sm" dang="chinh" type="submit">
                      <IcNguoi width={14} height={14} /> Lưu
                    </Button>
                  </form>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
