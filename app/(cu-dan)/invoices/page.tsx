import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Card, PageHead, Pill, Stat, Trong, cx, ngayVN, vnd } from '@/components/ui'
import { IcPhai } from '@/components/icons'

export const dynamic = 'force-dynamic'

const TT: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'tot' }> = {
  issued: { nhan: 'Chưa thanh toán', tone: 'canh' },
  partial: { nhan: 'Trả một phần', tone: 'canh' },
  paid: { nhan: 'Đã thanh toán', tone: 'tot' },
  void: { nhan: 'Đã hủy', tone: 'trung' },
}

export default async function Invoices() {
  const supabase = await createClient()
  // RLS lo phần lọc: chỉ hóa đơn căn mình, và family không thấy nếu chủ hộ
  // chưa bật can_view_finance.
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, period, total_amount, paid_amount, status, due_date, units(code)')
    .neq('status', 'draft')          // hóa đơn nháp là việc nội bộ của BQL
    .order('period', { ascending: false })

  const ds = invoices ?? []
  const homNay = new Date().toISOString().slice(0, 10)
  const conNo = ds.reduce((s, i) => s + Math.max(i.total_amount - i.paid_amount, 0), 0)
  const quaHan = ds.filter((i) => i.total_amount > i.paid_amount && i.due_date < homNay)

  return (
    <div className="space-y-5">
      <PageHead title="Hóa đơn" sub="Phí dịch vụ, điện, nước và gửi xe theo từng kỳ" />

      {ds.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Stat nhan="Còn phải trả" so={vnd(conNo)} tone={conNo > 0 ? 'xau' : 'tot'} />
          <Stat
            nhan="Quá hạn" so={quaHan.length}
            phu={quaHan.length
              ? vnd(quaHan.reduce((s, i) => s + i.total_amount - i.paid_amount, 0))
              : 'Không có'}
            tone={quaHan.length ? 'xau' : 'trung'}
          />
        </div>
      )}

      {!ds.length ? (
        <Trong title="Chưa có hóa đơn nào">
          Hóa đơn xuất hiện ở đây sau khi BQL phát hành cho kỳ thu phí.
        </Trong>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {ds.map((i) => {
              const conLai = i.total_amount - i.paid_amount
              const tre = conLai > 0 && i.due_date < homNay
              const tt = TT[i.status] ?? { nhan: i.status, tone: 'trung' as const }
              return (
                <li key={i.id}>
                  <Link
                    href={`/invoices/${i.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-raised"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-ink">
                          Kỳ {String(i.period).slice(5, 7)}/{String(i.period).slice(0, 4)}
                        </span>
                        <span className="text-[0.75rem] text-faint">{i.units?.code}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Pill tone={tre ? 'xau' : tt.tone}>{tre ? 'Quá hạn' : tt.nhan}</Pill>
                        <span className="text-[0.75rem] text-faint">
                          Hạn {ngayVN(String(i.due_date))}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cx('num text-sm font-semibold', conLai > 0 ? 'text-ink' : 'text-faint')}>
                        {vnd(conLai > 0 ? conLai : i.total_amount)}
                      </div>
                      {i.paid_amount > 0 && conLai > 0 && (
                        <div className="num text-[0.75rem] text-faint">đã trả {vnd(i.paid_amount)}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-faint"><IcPhai width={16} height={16} /></span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
