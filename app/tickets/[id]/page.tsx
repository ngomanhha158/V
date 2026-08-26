import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RatingForm } from './rating-form'

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

  return (
    <main className="space-y-5">
      <Link href="/tickets" className="text-sm underline">← Yêu cầu của tôi</Link>

      <div>
        <h1 className="text-2xl font-semibold">{ticket.title}</h1>
        <p className="text-sm opacity-70">
          {ticket.units?.code} · {ticket.units?.buildings?.name} · {ticket.category}
          {' · '}{STATUS_LABEL[ticket.status] ?? ticket.status}
        </p>
      </div>

      {ticket.description && <p className="whitespace-pre-wrap">{ticket.description}</p>}

      {signed && signed.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Ảnh kèm theo</h2>
          <div className="flex flex-wrap gap-2">
            {signed.map((s, i) =>
              s.signedUrl ? (
                <a key={i} href={s.signedUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.signedUrl} alt={`Ảnh ${i + 1}`}
                       className="h-28 w-28 rounded border object-cover" />
                </a>
              ) : (
                // Ký hụt (ảnh bị xóa, hoặc hết quyền) — nói ra thay vì hiện ô vỡ.
                <span key={i} className="flex h-28 w-28 items-center justify-center rounded border p-2 text-center text-xs opacity-70">
                  Không mở được ảnh {i + 1}
                </span>
              ),
            )}
          </div>
        </section>
      )}

      <section className="rounded border p-3 text-sm">
        <div className="font-medium">Hạn xử lý</div>
        {ticket.sla_resolve_due ? (
          <p className={overdue ? 'text-red-700' : ''}>
            {when(ticket.sla_resolve_due)}
            {overdue && ' — đã quá hạn'}
            {ticket.resolved_at && ` · hoàn thành ${when(ticket.resolved_at)}`}
          </p>
        ) : (
          // Danh mục không có trong sla_policies -> hạn NULL. Ticket vẫn hợp lệ,
          // chỉ là cron escalate bỏ qua nên không có cảnh báo tự động.
          <p className="opacity-70">Danh mục này chưa có hạn SLA nên không có cảnh báo tự động.</p>
        )}
      </section>

      {(ticket.status === 'resolved' || ticket.status === 'closed') && (
        ticket.rating
          ? (
            <section className="rounded border p-3 text-sm">
              <div className="font-medium">Bạn đã đánh giá {ticket.rating}/5 sao</div>
              {ticket.rating_note && <p className="mt-1 opacity-70">{ticket.rating_note}</p>}
            </section>
          )
          // Chỉ người trong căn mới gửi được; rate_ticket từ chối người ngoài.
          : isMember && <RatingForm ticketId={ticket.id} />
      )}

      <section className="space-y-2">
        <h2 className="font-medium">Diễn biến</h2>
        <ol className="space-y-2">
          {events?.map((e) => (
            <li key={e.id} className="rounded border p-3 text-sm">
              <div className="font-medium">{EVENT_LABEL[e.event_type] ?? e.event_type}</div>
              <div className="opacity-70">
                {e.from_value && e.to_value && `${STATUS_LABEL[e.from_value] ?? e.from_value} → ${STATUS_LABEL[e.to_value] ?? e.to_value} · `}
                {when(e.created_at)}
              </div>
              {e.note && <div className="mt-1">{e.note}</div>}
            </li>
          ))}
          {!events?.length && <li className="text-sm opacity-70">Chưa có diễn biến nào.</li>}
        </ol>
      </section>
    </main>
  )
}
