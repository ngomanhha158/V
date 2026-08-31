import Link from 'next/link'
import { CONG_NO, HOA_DON_KY_NAY, YEU_CAU_TOAN_KHU, ky } from '@/lib/demo/data'
import {
  Card, CardHead, LinkButton, PageHead, Pill, Stat, cx, ngayVN, vnd, vndGon,
} from '@/components/ui'
import { IcCanh, IcPhai } from '@/components/icons'

export const dynamic = 'force-dynamic'

const TT: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'brand' | 'tot' }> = {
  new: { nhan: 'Mới', tone: 'brand' },
  assigned: { nhan: 'Đã phân công', tone: 'brand' },
  in_progress: { nhan: 'Đang xử lý', tone: 'canh' },
  resolved: { nhan: 'Đã xong', tone: 'tot' },
  closed: { nhan: 'Đã đóng', tone: 'trung' },
}

export default function DemoBql() {
  const tongNo = CONG_NO.reduce((s, r) => s + r.con_no, 0)
  const quaHan = CONG_NO.filter((r) => r.so_ngay_qua_han > 0)
  const chuaXong = YEU_CAU_TOAN_KHU.filter((y) => !y.xong_luc)
  const treSla = chuaXong.filter((y) => new Date(y.han_xu_ly) < new Date())
  const nhap = HOA_DON_KY_NAY.filter((h) => h.trang_thai === 'draft')
  const daThu = HOA_DON_KY_NAY.filter((h) => h.trang_thai === 'paid')
  const tongKy = HOA_DON_KY_NAY.reduce((s, h) => s + h.tong, 0)
  const tyLeThu = Math.round((daThu.reduce((s, h) => s + h.tong, 0) / tongKy) * 100)

  return (
    <div className="space-y-5">
      <PageHead
        title="Tổng quan"
        sub={`Kỳ ${ky(0).slice(5, 7)}/${ky(0).slice(0, 4)} · cập nhật theo thời gian thực`}
      />

      {/* Việc đang cháy đặt trên cùng, trước cả số liệu. Người trực ban mở màn
          này để biết "có gì phải xử lý ngay không", không phải để ngắm biểu đồ. */}
      {treSla.length > 0 && (
        <Link
          href="/demo/bql/tickets"
          className="flex items-center gap-3 rounded-card border border-bad-line bg-bad-soft px-4 py-3 transition-opacity hover:opacity-90"
        >
          <IcCanh className="shrink-0 text-bad" />
          <div className="min-w-0 flex-1 text-[0.8125rem] text-bad">
            <b className="font-semibold">{treSla.length} yêu cầu đã quá hạn SLA.</b>{' '}
            Cron leo thang chạy 5 phút/lần và đã đẩy lên trưởng BQL.
          </div>
          <IcPhai className="shrink-0 text-bad" width={16} height={16} />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          nhan="Tổng phải thu" so={vnd(tongNo)} phu={`${CONG_NO.length} căn còn nợ`}
          href="/demo/bql/cong-no"
        />
        <Stat
          nhan="Nợ quá hạn" so={vndGon(quaHan.reduce((s, r) => s + r.con_no, 0))}
          phu={`${quaHan.length} căn`} tone="xau" href="/demo/bql/cong-no?nhom=d0_30"
        />
        <Stat
          nhan="Yêu cầu đang mở" so={chuaXong.length}
          phu={treSla.length ? `${treSla.length} quá hạn SLA` : 'Đều trong hạn'}
          tone={treSla.length ? 'canh' : 'tot'} href="/demo/bql/tickets"
        />
        <Stat
          nhan="Tỷ lệ thu kỳ này" so={`${tyLeThu}%`}
          phu={`${nhap.length} hóa đơn còn nháp`} href="/demo/bql/billing"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Nợ nhiều nhất"
            sub="Xếp theo số tiền còn thiếu"
            right={
              <LinkButton href="/demo/bql/cong-no" dang="nhat" co="sm">
                Xem hết <IcPhai width={14} height={14} />
              </LinkButton>
            }
          />
          <ul className="divide-y divide-line">
            {CONG_NO.slice(0, 5).map((r) => (
              <li key={r.unit_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{r.unit_code}</div>
                  <div className="truncate text-[0.75rem] text-faint">
                    {r.ten_lien_he ?? 'Chưa có chủ hộ'} · {r.so_hoa_don} hóa đơn
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cx('num text-sm font-semibold', r.so_ngay_qua_han > 90 ? 'text-bad' : 'text-ink')}>
                    {vnd(r.con_no)}
                  </div>
                  <div className="text-[0.75rem] text-faint">
                    {r.so_ngay_qua_han > 0 ? `quá ${r.so_ngay_qua_han} ngày` : 'chưa tới hạn'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHead
            title="Yêu cầu cần xử lý"
            sub="Quá hạn xếp lên trước"
            right={
              <LinkButton href="/demo/bql/tickets" dang="nhat" co="sm">
                Điều phối <IcPhai width={14} height={14} />
              </LinkButton>
            }
          />
          <ul className="divide-y divide-line">
            {[...chuaXong]
              .sort((a, b) => Number(new Date(a.han_xu_ly)) - Number(new Date(b.han_xu_ly)))
              .map((y) => {
                const tre = new Date(y.han_xu_ly) < new Date()
                return (
                  <li key={y.id} className="px-4 py-3">
                    <div className="text-sm font-medium text-ink">{y.tieu_de}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill tone={TT[y.trang_thai].tone}>{TT[y.trang_thai].nhan}</Pill>
                      {tre && <Pill tone="xau">Quá hạn</Pill>}
                      <span className="text-[0.75rem] text-faint">
                        {y.can} · hạn {ngayVN(y.han_xu_ly)}
                      </span>
                    </div>
                  </li>
                )
              })}
          </ul>
        </Card>
      </div>
    </div>
  )
}
