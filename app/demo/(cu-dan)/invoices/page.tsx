import Link from 'next/link'
import { HOA_DON } from '@/lib/demo/data'
import { Card, PageHead, Pill, Stat, cx, ngayVN, vnd } from '@/components/ui'
import { IcPhai } from '@/components/icons'

export const dynamic = 'force-dynamic'

const TT = {
  issued: { nhan: 'Chưa thanh toán', tone: 'canh' as const },
  partial: { nhan: 'Trả một phần', tone: 'canh' as const },
  paid: { nhan: 'Đã thanh toán', tone: 'tot' as const },
}

export default function DemoInvoices() {
  const homNay = new Date().toISOString().slice(0, 10)
  const conNo = HOA_DON.reduce((s, h) => s + (h.tong - h.da_tra), 0)
  const quaHan = HOA_DON.filter((h) => h.tong > h.da_tra && h.han < homNay)

  return (
    <div className="space-y-5">
      <PageHead title="Hóa đơn" sub="Phí dịch vụ, điện, nước và gửi xe theo từng kỳ" />

      <div className="grid grid-cols-2 gap-3">
        <Stat nhan="Còn phải trả" so={vnd(conNo)} tone={conNo > 0 ? 'xau' : 'tot'} />
        <Stat
          nhan="Quá hạn"
          so={quaHan.length}
          phu={quaHan.length ? vnd(quaHan.reduce((s, h) => s + h.tong - h.da_tra, 0)) : 'Không có'}
          tone={quaHan.length ? 'xau' : 'trung'}
        />
      </div>

      <Card>
        <ul className="divide-y divide-line">
          {HOA_DON.map((h) => {
            const conLai = h.tong - h.da_tra
            const tre = conLai > 0 && h.han < homNay
            const tt = TT[h.trang_thai]
            return (
              <li key={h.id}>
                <Link
                  href={`/demo/invoices/${h.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-raised"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-ink">
                        Kỳ {h.ky.slice(5, 7)}/{h.ky.slice(0, 4)}
                      </span>
                      <span className="text-[0.75rem] text-faint">{h.can}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Pill tone={tre ? 'xau' : tt.tone}>{tre ? 'Quá hạn' : tt.nhan}</Pill>
                      <span className="text-[0.75rem] text-faint">
                        Hạn {ngayVN(h.han)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={cx('num text-sm font-semibold', conLai > 0 ? 'text-ink' : 'text-faint')}>
                      {vnd(conLai > 0 ? conLai : h.tong)}
                    </div>
                    {h.da_tra > 0 && conLai > 0 && (
                      <div className="num text-[0.75rem] text-faint">
                        đã trả {vnd(h.da_tra)}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-faint"><IcPhai width={16} height={16} /></span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
