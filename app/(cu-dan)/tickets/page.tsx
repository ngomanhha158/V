import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, LinkButton, PageHead, Pill, Trong, cx, ngayVN } from '@/components/ui'
import { IcPhai, IcThem } from '@/components/icons'

export const dynamic = 'force-dynamic'

export const TT: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'brand' | 'tot' | 'xau' }> = {
  new: { nhan: 'Mới', tone: 'brand' },
  assigned: { nhan: 'Đã phân công', tone: 'brand' },
  in_progress: { nhan: 'Đang xử lý', tone: 'canh' },
  resolved: { nhan: 'Đã xong', tone: 'tot' },
  closed: { nhan: 'Đã đóng', tone: 'trung' },
  rejected: { nhan: 'Từ chối', tone: 'xau' },
}
export const UU: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'xau' }> = {
  low: { nhan: 'Thấp', tone: 'trung' },
  normal: { nhan: 'Bình thường', tone: 'trung' },
  high: { nhan: 'Cao', tone: 'canh' },
  urgent: { nhan: 'Khẩn cấp', tone: 'xau' },
}

export function Sao({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cx('text-[0.8125rem]', i <= n ? 'text-warn' : 'text-line-firm')}>★</span>
      ))}
    </span>
  )
}

export default async function Tickets() {
  const supabase = await createClient()
  // RLS lo phần lọc: chỉ ticket của căn mình, hoặc toàn dự án nếu là BQL.
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, title, category, priority, status, created_at, sla_resolve_due, resolved_at, rating, units(code)')
    .order('created_at', { ascending: false })

  const ds = tickets ?? []
  const mo = ds.filter((t) => !t.resolved_at)
  const xong = ds.filter((t) => t.resolved_at)

  return (
    <div className="space-y-5">
      <PageHead
        title="Yêu cầu của tôi"
        sub="Sự cố đã báo và tiến độ xử lý của BQL"
        actions={
          <LinkButton href="/tickets/new" dang="chinh" co="sm">
            <IcThem width={15} height={15} /> Báo sự cố
          </LinkButton>
        }
      />

      {!ds.length ? (
        <Trong
          title="Chưa có yêu cầu nào"
          action={<LinkButton href="/tickets/new" dang="chinh" co="sm">Báo sự cố đầu tiên</LinkButton>}
        >
          Hỏng nước, kẹt thang máy, mất điện — báo ở đây để BQL nhận và chạy
          theo cam kết thời gian (SLA).
        </Trong>
      ) : (
        [{ tieu: 'Đang xử lý', ds: mo }, { tieu: 'Đã hoàn thành', ds: xong }]
          .filter((n) => n.ds.length > 0)
          .map((nhom) => (
            <section key={nhom.tieu} className="space-y-2">
              <h2 className="px-1 text-[0.75rem] font-semibold tracking-wider text-faint uppercase">
                {nhom.tieu} ({nhom.ds.length})
              </h2>
              <Card>
                <ul className="divide-y divide-line">
                  {nhom.ds.map((t) => {
                    // Quá hạn = còn chưa xong mà đã qua hạn. Xong rồi thì thôi, không bêu.
                    const tre = !t.resolved_at && t.sla_resolve_due
                      && new Date(t.sla_resolve_due) < new Date()
                    const tt = TT[t.status] ?? { nhan: t.status, tone: 'trung' as const }
                    return (
                      <li key={t.id}>
                        <Link
                          href={`/tickets/${t.id}`}
                          className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-raised"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-ink">{t.title}</div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Pill tone={tt.tone}>{tt.nhan}</Pill>
                              {UU[t.priority] && UU[t.priority].tone !== 'trung' && (
                                <Pill tone={UU[t.priority].tone}>{UU[t.priority].nhan}</Pill>
                              )}
                              {tre && <Pill tone="xau">Quá hạn SLA</Pill>}
                            </div>
                            <div className="mt-1.5 text-[0.75rem] text-faint">
                              {t.units?.code} · {t.category} · báo {ngayVN(String(t.created_at))}
                            </div>
                            {t.rating && <div className="mt-1.5"><Sao n={t.rating} /></div>}
                          </div>
                          <span className="mt-1 shrink-0 text-faint"><IcPhai width={16} height={16} /></span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </section>
          ))
      )}
    </div>
  )
}
