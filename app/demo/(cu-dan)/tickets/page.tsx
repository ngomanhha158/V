import Link from 'next/link'
import { YEU_CAU } from '@/lib/demo/data'
import { Card, LinkButton, PageHead, Pill, cx, ngayVN } from '@/components/ui'
import { IcPhai, IcThem } from '@/components/icons'

export const dynamic = 'force-dynamic'

export const TT: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'brand' | 'tot' }> = {
  new: { nhan: 'Mới', tone: 'brand' },
  assigned: { nhan: 'Đã phân công', tone: 'brand' },
  in_progress: { nhan: 'Đang xử lý', tone: 'canh' },
  resolved: { nhan: 'Đã xong', tone: 'tot' },
  closed: { nhan: 'Đã đóng', tone: 'trung' },
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

export default function DemoTickets() {
  const mo = YEU_CAU.filter((y) => !y.xong_luc)
  const xong = YEU_CAU.filter((y) => y.xong_luc)

  return (
    <div className="space-y-5">
      <PageHead
        title="Yêu cầu của tôi"
        sub="Sự cố đã báo và tiến độ xử lý của BQL"
        actions={
          <LinkButton href="/demo/tickets" dang="chinh" co="sm">
            <IcThem width={15} height={15} /> Báo sự cố
          </LinkButton>
        }
      />

      {[
        { tieu: 'Đang xử lý', ds: mo },
        { tieu: 'Đã hoàn thành', ds: xong },
      ].filter((n) => n.ds.length > 0).map((nhom) => (
        <section key={nhom.tieu} className="space-y-2">
          <h2 className="px-1 text-[0.75rem] font-semibold tracking-wider text-faint uppercase">
            {nhom.tieu} ({nhom.ds.length})
          </h2>
          <Card>
            <ul className="divide-y divide-line">
              {nhom.ds.map((y) => {
                const tre = !y.xong_luc && new Date(y.han_xu_ly) < new Date()
                return (
                  <li key={y.id}>
                    <Link
                      href={`/demo/tickets/${y.id}`}
                      className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-raised"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink">{y.tieu_de}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Pill tone={TT[y.trang_thai].tone}>{TT[y.trang_thai].nhan}</Pill>
                          {UU[y.uu_tien].tone !== 'trung' && (
                            <Pill tone={UU[y.uu_tien].tone}>{UU[y.uu_tien].nhan}</Pill>
                          )}
                          {tre && <Pill tone="xau">Quá hạn SLA</Pill>}
                        </div>
                        <div className="mt-1.5 text-[0.75rem] text-faint">
                          {y.can} · báo {ngayVN(y.tao_luc)}
                          {y.nguoi_xu_ly && ` · ${y.nguoi_xu_ly}`}
                        </div>
                        {y.danh_gia && <div className="mt-1.5"><Sao n={y.danh_gia} /></div>}
                      </div>
                      <span className="mt-1 shrink-0 text-faint"><IcPhai width={16} height={16} /></span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  )
}
