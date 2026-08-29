import Link from 'next/link'
import { CAN_CUA_TOI, HOA_DON, YEU_CAU } from '@/lib/demo/data'
import { Card, CardHead, LinkButton, Pill, Trong, cx, ngayVN, vnd } from '@/components/ui'
import { IcHoaDon, IcPhai, IcThem, IcToaNha, IcYeuCau } from '@/components/icons'

export const dynamic = 'force-dynamic'

const TT: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'brand' | 'tot' }> = {
  new: { nhan: 'Mới', tone: 'brand' },
  assigned: { nhan: 'Đã phân công', tone: 'brand' },
  in_progress: { nhan: 'Đang xử lý', tone: 'canh' },
  resolved: { nhan: 'Đã xong', tone: 'tot' },
  closed: { nhan: 'Đã đóng', tone: 'trung' },
}

export default function DemoHome() {
  const conNo = HOA_DON.reduce((s, h) => s + (h.tong - h.da_tra), 0)
  const soTo = HOA_DON.filter((h) => h.tong > h.da_tra).length
  const gapNhat = HOA_DON.filter((h) => h.tong > h.da_tra)
    .sort((a, b) => a.han.localeCompare(b.han))[0]
  const dangMo = YEU_CAU.filter((y) => !y.xong_luc)

  return (
    <div className="space-y-5">
      {/* Việc gấp nhất đặt cao nhất: còn nợ bao nhiêu, hạn khi nào. Cư dân mở
          app phần lớn là vì hai câu hỏi đó. */}
      {conNo > 0 && (
        <Link
          href="/demo/invoices"
          className="block rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-firm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[0.8125rem] font-medium text-muted">Cần thanh toán</div>
              <div className="num mt-1 text-[1.75rem] leading-none font-semibold text-ink">
                {vnd(conNo)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone={gapNhat && gapNhat.han < new Date().toISOString().slice(0, 10) ? 'xau' : 'canh'}>
                  {gapNhat && gapNhat.han < new Date().toISOString().slice(0, 10)
                    ? `Quá hạn ${ngayVN(gapNhat.han)}`
                    : `Hạn ${gapNhat ? ngayVN(gapNhat.han) : ''}`}
                </Pill>
                <span className="text-[0.8125rem] text-faint">{soTo} hóa đơn</span>
              </div>
            </div>
            <span className="mt-1 shrink-0 text-faint"><IcPhai /></span>
          </div>
        </Link>
      )}

      <Card>
        <CardHead
          title="Căn hộ của tôi"
          right={<span className="text-[0.8125rem] text-faint">{CAN_CUA_TOI.length}</span>}
        />
        <ul className="divide-y divide-line">
          {CAN_CUA_TOI.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-faint">
                <IcToaNha />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{c.code}</div>
                <div className="truncate text-[0.8125rem] text-muted">
                  {c.toa} · tầng {c.tang} · {c.dien_tich} m²
                </div>
              </div>
              <Pill tone={c.vai_tro === 'Chủ hộ' ? 'brand' : 'trung'} cham={false}>
                {c.vai_tro}
              </Pill>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHead
          title="Yêu cầu đang xử lý"
          right={
            <LinkButton href="/demo/tickets" dang="nhat" co="sm">
              Tất cả <IcPhai width={14} height={14} />
            </LinkButton>
          }
        />
        {dangMo.length === 0 ? (
          <div className="p-4">
            <Trong title="Không có yêu cầu nào đang mở">
              Nhà cửa đang yên. Có sự cố thì báo ngay để BQL vào SLA.
            </Trong>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {dangMo.map((y) => {
              const tre = new Date(y.han_xu_ly) < new Date()
              const tt = TT[y.trang_thai]
              return (
                <li key={y.id}>
                  <Link
                    href={`/demo/tickets/${y.id}`}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-raised"
                  >
                    <span className={cx('mt-0.5 shrink-0', tre ? 'text-bad' : 'text-faint')}>
                      <IcYeuCau />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{y.tieu_de}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Pill tone={tt.tone}>{tt.nhan}</Pill>
                        {tre && <Pill tone="xau">Quá hạn SLA</Pill>}
                        <span className="text-[0.75rem] text-faint">{y.can}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <LinkButton href="/demo/tickets" dang="chinh" className="h-11">
          <IcThem width={16} height={16} /> Báo sự cố
        </LinkButton>
        <LinkButton href="/demo/invoices" dang="phu" className="h-11">
          <IcHoaDon width={16} height={16} /> Xem hóa đơn
        </LinkButton>
      </div>
    </div>
  )
}
