import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong, cx, vnd } from '@/components/ui'
import { NHAN_DOT, TONE_DOT, gomTheoKeHoach, kyVN, loiDot, trangThaiDot } from '@/lib/tra-gop'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: ds, error } = await db.rpc('tra_gop_cua_toi')
  const nhom = gomTheoKeHoach(ds ?? [])

  return (
    <div className="space-y-5">
      <PageHead
        title="Khoản chia đợt"
        sub="Khoản lớn của cả tòa được chia thành nhiều tháng, cộng thẳng vào hóa đơn từng kỳ"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần thu theo đợt chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {!error && nhom.length === 0 && (
        <Trong title="Chưa có khoản nào chia đợt">
          Khi ban quản trị duyệt một khoản chi lớn và chia thành nhiều tháng, nó
          hiện ở đây kèm số nghị quyết.
        </Trong>
      )}

      {nhom.map((g) => {
        const conLai = g.dot
          .filter((d) => trangThaiDot({ ...d, huy_luc: g.huy_luc }) !== 'da_tra')
          .reduce((t, d) => t + d.so_tien, 0)
        return (
          <Card key={`${g.ke_hoach_id}:${g.unit_id}`}>
            <CardHead
              xuongDong
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words">{g.ten}</span>
                  {g.huy_luc && <Pill tone="trung">Đã dừng thu</Pill>}
                </span>
              }
              sub={`Căn ${g.ma_can} · ${g.so_dot} đợt · nghị quyết ${g.nghi_quyet}`}
            />
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[9rem] flex-1 rounded-card border border-line bg-sunken px-3.5 py-3">
                  <div className="text-[0.75rem] font-medium text-muted">Phần của căn bạn</div>
                  <div className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                    {vnd(g.tong_phai_tra)}
                  </div>
                </div>
                <div className="min-w-[9rem] flex-1 rounded-card border border-line bg-sunken px-3.5 py-3">
                  <div className="text-[0.75rem] font-medium text-muted">Còn nằm ở các kỳ tới</div>
                  <div className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                    {vnd(conLai)}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-line rounded-card border border-line">
                {g.dot
                  .slice()
                  .sort((a, b) => a.thu_tu - b.thu_tu)
                  .map((d) => {
                    const t = trangThaiDot({ ...d, huy_luc: g.huy_luc })
                    return (
                      <div key={d.thu_tu} className={cx('px-3.5 py-3', t === 'da_huy' && 'opacity-60')}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[0.8125rem] font-medium text-ink">
                              Đợt {d.thu_tu}/{g.so_dot}
                            </span>
                            <span className="num text-[0.8125rem] text-muted"> · kỳ {kyVN(d.ky)}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="num text-[0.8125rem] font-semibold text-ink">
                              {vnd(d.so_tien)}
                            </span>
                            <Pill tone={TONE_DOT[t]}>{NHAN_DOT[t]}</Pill>
                          </div>
                        </div>
                        <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">
                          {loiDot({ ...d, huy_luc: g.huy_luc }, kyVN)}
                          {d.hoa_don_id && (
                            <>
                              {' '}
                              <Link
                                href={`/invoices/${d.hoa_don_id}`}
                                className="font-medium text-brand hover:underline"
                              >
                                Mở hóa đơn
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                    )
                  })}
              </div>
            </div>
          </Card>
        )
      })}

      <Hop tone="trung" title="Vì sao không có nút trả riêng cho từng đợt">
        Mỗi đợt đã là một dòng trên hóa đơn tháng của bạn, nên bạn vẫn chuyển
        MỘT lần mỗi tháng như cũ, đúng mã QR cũ. Muốn trả sớm cho xong thì trả
        đủ hóa đơn của các kỳ đó khi chúng phát hành — không có khoản phạt nào
        cho việc trả đúng lịch, và cũng không có ưu đãi nào cho trả sớm.
      </Hop>
    </div>
  )
}
