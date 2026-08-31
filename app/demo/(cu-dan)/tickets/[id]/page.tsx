import Link from 'next/link'
import { notFound } from 'next/navigation'
import { YEU_CAU } from '@/lib/demo/data'
import { Button, Card, CardHead, Doi, Hop, PageHead, Pill, cx, ngayVN } from '@/components/ui'
import { IcTrai } from '@/components/icons'
import { Sao, TT, UU } from '../page'

export const dynamic = 'force-dynamic'

export default async function DemoTicketDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = YEU_CAU.find((y) => y.id === id)
  if (!t) notFound()

  const tre = !t.xong_luc && new Date(t.han_xu_ly) < new Date()

  return (
    <div className="space-y-5">
      <Link
        href="/demo/tickets"
        className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
      >
        <IcTrai width={16} height={16} /> Yêu cầu
      </Link>

      <PageHead
        title={t.tieu_de}
        sub={`${t.can} · ${t.loai}`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={TT[t.trang_thai].tone}>{TT[t.trang_thai].nhan}</Pill>
            {UU[t.uu_tien].tone !== 'trung' && (
              <Pill tone={UU[t.uu_tien].tone}>{UU[t.uu_tien].nhan}</Pill>
            )}
          </div>
        }
      />

      {tre && (
        <Hop tone="xau" title="Quá hạn xử lý theo SLA">
          Hạn cam kết là {ngayVN(t.han_xu_ly)}. Hệ thống đã tự đẩy yêu cầu lên
          trưởng BQL — cron leo thang chạy 5 phút một lần.
        </Hop>
      )}

      <Card>
        <CardHead title="Nội dung phản ánh" />
        <p className="px-4 py-3.5 text-sm leading-relaxed text-ink">{t.mo_ta}</p>
        <dl className="border-t border-line px-4 py-1">
          <Doi nhan="Hạn xử lý (SLA)">
            <span className={cx('num', tre && 'text-bad')}>{ngayVN(t.han_xu_ly)}</span>
          </Doi>
          <Doi nhan="Người xử lý">
            {t.nguoi_xu_ly ?? <span className="text-faint">Chưa phân công</span>}
          </Doi>
          {t.xong_luc && (
            <Doi nhan="Hoàn thành"><span className="num text-ok">{ngayVN(t.xong_luc)}</span></Doi>
          )}
        </dl>
      </Card>

      <Card>
        <CardHead title="Diễn biến" sub="Nhật ký này bất biến — không ai sửa được sau khi ghi" />
        <ol className="px-4 py-4">
          {t.lich_su.map((e, i) => {
            const cuoi = i === t.lich_su.length - 1
            return (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {!cuoi && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-line" />}
                <span
                  className={cx(
                    'relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface',
                    cuoi ? 'bg-brand' : 'bg-line-firm',
                  )}
                />
                <div className="min-w-0 flex-1 -mt-0.5">
                  <div className="text-sm text-ink">{e.viec}</div>
                  <div className="mt-0.5 text-[0.75rem] text-faint">
                    {e.ai} · {ngayVN(e.luc)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </Card>

      {t.trang_thai === 'resolved' && !t.danh_gia && (
        <Card>
          <CardHead
            title="Đánh giá chất lượng xử lý"
            sub="Điểm này vào KPI của ban quản trị, không phải để cho vui"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex gap-1 text-2xl text-line-firm">
              {[1, 2, 3, 4, 5].map((i) => <span key={i}>★</span>)}
            </div>
            <Button dang="chinh" co="sm" disabled>Gửi đánh giá</Button>
          </div>
        </Card>
      )}

      {t.danh_gia && (
        <Card>
          <div className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm text-muted">Bạn đã đánh giá</span>
            <Sao n={t.danh_gia} />
          </div>
        </Card>
      )}
    </div>
  )
}
