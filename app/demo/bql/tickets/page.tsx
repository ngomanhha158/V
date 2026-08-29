import { YEU_CAU_TOAN_KHU } from '@/lib/demo/data'
import { Button, Card, CardHead, PageHead, Pill, Stat, cx, ngayVN } from '@/components/ui'
import { IcNguoi } from '@/components/icons'

export const dynamic = 'force-dynamic'

const TT: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'brand' | 'tot' }> = {
  new: { nhan: 'Mới', tone: 'brand' },
  assigned: { nhan: 'Đã phân công', tone: 'brand' },
  in_progress: { nhan: 'Đang xử lý', tone: 'canh' },
  resolved: { nhan: 'Đã xong', tone: 'tot' },
  closed: { nhan: 'Đã đóng', tone: 'trung' },
}
const UU: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'xau' }> = {
  low: { nhan: 'Thấp', tone: 'trung' },
  normal: { nhan: 'Bình thường', tone: 'trung' },
  high: { nhan: 'Cao', tone: 'canh' },
  urgent: { nhan: 'Khẩn cấp', tone: 'xau' },
}

export default function DemoBqlTickets() {
  const now = Date.now()
  const tre = (y: (typeof YEU_CAU_TOAN_KHU)[number]) =>
    !y.xong_luc && new Date(y.han_xu_ly).getTime() < now

  // Quá hạn lên đầu, rồi tới hạn gần nhất. Màn điều phối phải bày ra việc đang
  // cháy chứ không phải xếp theo ngày tạo.
  const sap = [...YEU_CAU_TOAN_KHU].sort((a, b) => {
    const d = Number(tre(b)) - Number(tre(a))
    return d !== 0 ? d : a.han_xu_ly.localeCompare(b.han_xu_ly)
  })

  const mo = sap.filter((y) => !y.xong_luc)
  const quaHan = mo.filter(tre)

  return (
    <div className="space-y-5">
      <PageHead title="Điều phối yêu cầu" sub="Toàn khu, xếp theo mức độ cháy" />

      <div className="grid grid-cols-3 gap-3">
        <Stat nhan="Đang mở" so={mo.length} />
        <Stat nhan="Quá hạn SLA" so={quaHan.length} tone={quaHan.length ? 'xau' : 'tot'} />
        <Stat nhan="Chưa phân công" so={mo.filter((y) => !y.nguoi_xu_ly).length} tone="canh" />
      </div>

      <Card>
        <CardHead title="Danh sách yêu cầu" right={<span className="text-[0.8125rem] text-faint">{sap.length}</span>} />
        <ul className="divide-y divide-line">
          {sap.map((y) => {
            const t = tre(y)
            return (
              <li
                key={y.id}
                className={cx('px-4 py-4 transition-colors hover:bg-raised', t && 'bg-bad-soft/40')}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{y.tieu_de}</span>
                      {t && <Pill tone="xau">Quá hạn SLA</Pill>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill tone={TT[y.trang_thai].tone}>{TT[y.trang_thai].nhan}</Pill>
                      {UU[y.uu_tien].tone !== 'trung' && (
                        <Pill tone={UU[y.uu_tien].tone}>{UU[y.uu_tien].nhan}</Pill>
                      )}
                      <Pill tone="trung" cham={false}>{y.loai}</Pill>
                    </div>
                    <div className="mt-2 text-[0.8125rem] text-muted">
                      <span className="font-medium text-ink">{y.can}</span>
                      {' · '}{y.nguoi_bao}
                      {' · '}hạn <span className={cx('num', t && 'font-medium text-bad')}>{ngayVN(y.han_xu_ly)}</span>
                    </div>
                    {t && (
                      <div className="mt-1.5 text-[0.75rem] text-bad">
                        Cron leo thang đã đẩy lên trưởng BQL
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button co="sm" disabled>
                      <IcNguoi width={14} height={14} />
                      {y.nguoi_xu_ly ? 'Đổi người xử lý' : 'Phân công'}
                    </Button>
                    <Button co="sm" dang="chinh" disabled>Đổi trạng thái</Button>
                  </div>
                </div>

                {y.nguoi_xu_ly && (
                  <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5 text-[0.8125rem] text-muted">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sunken text-[0.625rem] font-semibold text-muted">
                      {y.nguoi_xu_ly.slice(0, 1)}
                    </span>
                    {y.nguoi_xu_ly}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
