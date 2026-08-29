import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RatingForm } from './rating-form'
import { Card, CardHead, Hop, PageHead, Pill, Trong, cx } from '@/components/ui'
import { IcTrai } from '@/components/icons'
import { Sao, TT, UU } from '../page'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  new: 'Mới', assigned: 'Đã phân công', in_progress: 'Đang xử lý',
  resolved: 'Đã xong', closed: 'Đã đóng', rejected: 'Từ chối',
}
const EVENT_LABEL: Record<string, string> = {
  created: 'Đã gửi yêu cầu', status_changed: 'Đổi trạng thái',
  escalated: 'Leo thang do quá hạn', assigned: 'Phân công', commented: 'Bình luận',
}

function when(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, title, description, category, priority, status, created_at, sla_respond_due, sla_resolve_due, responded_at, resolved_at, rating, rating_note, unit_id, photo_urls, units(code, buildings(name))')
    .eq('id', id)
    .maybeSingle()
  if (!ticket) notFound()

  // BQL cũng thấy ticket này (policy ticket_resident_read có nhánh is_staff),
  // nhưng chấm điểm là việc của cư dân — không hiện form cho BQL.
  const { data: myUnits } = await supabase.rpc('current_unit_ids')
  const isMember = (myUnits ?? []).includes(ticket.unit_id)

  // ticket_events chỉ đọc được nếu đọc được chính ticket (policy ticket_event_read).
  const { data: events } = await supabase
    .from('ticket_events')
    .select('id, event_type, from_value, to_value, note, created_at')
    .eq('ticket_id', id)
    .order('created_at')

  const overdue = !ticket.resolved_at && ticket.sla_resolve_due
    && new Date(ticket.sla_resolve_due) < new Date()

  // Bucket riêng tư nên URL thẳng không xem được — phải ký, hạn 1 giờ.
  // RLS của Storage vẫn là chốt chặn: ký hộ đường dẫn không phải căn mình thì
  // Supabase từ chối ngay ở đây.
  const photos = ticket.photo_urls ?? []
  const { data: signed } = photos.length
    ? await supabase.storage.from('ticket-photos').createSignedUrls(photos, 3600)
    : { data: null }

  const tt = TT[ticket.status] ?? { nhan: ticket.status, tone: 'trung' as const }

  return (
    <div className="space-y-5">
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
      >
        <IcTrai width={16} height={16} /> Yêu cầu của tôi
      </Link>

      <PageHead
        title={ticket.title}
        sub={`${ticket.units?.code} · ${ticket.units?.buildings?.name} · ${ticket.category}`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={tt.tone}>{tt.nhan}</Pill>
            {UU[ticket.priority] && UU[ticket.priority].tone !== 'trung' && (
              <Pill tone={UU[ticket.priority].tone}>{UU[ticket.priority].nhan}</Pill>
            )}
          </div>
        }
      />

      {overdue && (
        <Hop tone="xau" title="Quá hạn xử lý theo SLA">
          Hạn cam kết là {when(ticket.sla_resolve_due!)}. Hệ thống đã tự đẩy yêu
          cầu lên trưởng BQL — cron leo thang chạy 5 phút một lần.
        </Hop>
      )}

      {ticket.description && (
        <Card>
          <CardHead title="Nội dung phản ánh" />
          <p className="px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap text-ink">
            {ticket.description}
          </p>
        </Card>
      )}

      {signed && signed.length > 0 && (
        <Card>
          <CardHead title="Ảnh kèm theo" sub="Đường dẫn có chữ ký, hết hạn sau 1 giờ" />
          <div className="flex flex-wrap gap-2 p-4">
            {signed.map((s, i) =>
              s.signedUrl ? (
                <a
                  key={i} href={s.signedUrl} target="_blank" rel="noreferrer"
                  className="overflow-hidden rounded-ctl border border-line transition-opacity hover:opacity-85"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.signedUrl} alt={`Ảnh ${i + 1}`} className="size-28 object-cover" />
                </a>
              ) : (
                // Ký hụt (ảnh bị xóa, hoặc hết quyền) — nói ra thay vì hiện ô vỡ.
                <span
                  key={i}
                  className="grid size-28 place-items-center rounded-ctl border border-dashed border-line-firm p-2 text-center text-[0.75rem] text-faint"
                >
                  Không mở được ảnh {i + 1}
                </span>
              ),
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHead title="Cam kết thời gian (SLA)" />
        <div className="px-4 py-3.5 text-sm">
          {ticket.sla_resolve_due ? (
            <>
              <div className="flex items-baseline justify-between gap-4 py-1">
                <span className="text-muted">Hạn hoàn thành</span>
                <span className={cx('num font-medium', overdue ? 'text-bad' : 'text-ink')}>
                  {when(ticket.sla_resolve_due)}
                </span>
              </div>
              {ticket.resolved_at && (
                <div className="flex items-baseline justify-between gap-4 py-1">
                  <span className="text-muted">Hoàn thành lúc</span>
                  <span className="num font-medium text-ok">{when(ticket.resolved_at)}</span>
                </div>
              )}
            </>
          ) : (
            // Danh mục không có trong sla_policies -> hạn NULL. Ticket vẫn hợp lệ,
            // chỉ là cron escalate bỏ qua nên không có cảnh báo tự động.
            <p className="text-muted">
              Danh mục này chưa có hạn SLA nên không có cảnh báo tự động.
            </p>
          )}
        </div>
      </Card>

      {(ticket.status === 'resolved' || ticket.status === 'closed') && (
        ticket.rating
          ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm text-muted">Bạn đã đánh giá</span>
                <Sao n={ticket.rating} />
              </div>
              {ticket.rating_note && (
                <p className="border-t border-line px-4 py-3 text-[0.8125rem] text-muted">
                  {ticket.rating_note}
                </p>
              )}
            </Card>
          )
          // Chỉ người trong căn mới gửi được; rate_ticket từ chối người ngoài.
          : isMember && (
            <Card>
              <CardHead
                title="Đánh giá chất lượng xử lý"
                sub="Điểm này vào KPI của ban quản trị, không phải để cho vui"
              />
              <div className="p-4"><RatingForm ticketId={ticket.id} /></div>
            </Card>
          )
      )}

      <Card>
        <CardHead title="Diễn biến" sub="Nhật ký này bất biến — không ai sửa được sau khi ghi" />
        {!events?.length ? (
          <div className="p-4"><Trong title="Chưa có diễn biến nào" /></div>
        ) : (
          <ol className="px-4 py-4">
            {events.map((e, i) => {
              const cuoi = i === events.length - 1
              return (
                <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {!cuoi && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-line" />}
                  <span
                    className={cx(
                      'relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface',
                      e.event_type === 'escalated' ? 'bg-bad' : cuoi ? 'bg-brand' : 'bg-line-firm',
                    )}
                  />
                  <div className="-mt-0.5 min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">
                      {EVENT_LABEL[e.event_type] ?? e.event_type}
                    </div>
                    {e.from_value && e.to_value && (
                      <div className="mt-0.5 text-[0.8125rem] text-muted">
                        {STATUS_LABEL[e.from_value] ?? e.from_value}
                        {' → '}
                        {STATUS_LABEL[e.to_value] ?? e.to_value}
                      </div>
                    )}
                    {e.note && <div className="mt-0.5 text-[0.8125rem] text-muted">{e.note}</div>}
                    <div className="mt-0.5 text-[0.75rem] text-faint">{when(e.created_at)}</div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Card>
    </div>
  )
}
