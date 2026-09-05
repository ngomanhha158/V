import { Card, CardHead, Hop, PageHead, Pill, cx, vnd } from '@/components/ui'
import { NHAN_DOT, TONE_DOT, kyVN, loiDot, trangThaiDot } from '@/lib/tra-gop'
import { CUA_TOI, KE_HOACH } from '@/app/demo/tra-gop-mock'

export default function Page() {
  const k = KE_HOACH
  const c = CUA_TOI
  const dot = c.dot.map((d) => ({ ...d, hoa_don_id: d.hoa_don_trang_thai ? 'x' : null, huy_luc: null }))
  const tong = dot.reduce((t, d) => t + d.so_tien, 0)
  const conLai = dot.filter((d) => trangThaiDot(d) !== 'da_tra').reduce((t, d) => t + d.so_tien, 0)

  return (
    <div className="space-y-5">
      <PageHead
        title="Khoản chia đợt"
        sub="Khoản lớn của cả tòa được chia thành nhiều tháng, cộng thẳng vào hóa đơn từng kỳ"
      />

      <Card>
        <CardHead
          xuongDong
          title={k.ten}
          sub={`Căn ${c.ma_can} · ${k.so_dot} đợt · nghị quyết ${k.nghi_quyet}`}
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[9rem] flex-1 rounded-card border border-line bg-sunken px-3.5 py-3">
              <div className="text-[0.75rem] font-medium text-muted">Phần của căn bạn</div>
              <div className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                {vnd(tong)}
              </div>
              <div className="num mt-1.5 text-[0.75rem] text-faint">
                {c.dien_tich.toLocaleString('vi-VN')} m² trên {k.tong_dien_tich.toLocaleString('vi-VN')} m² toàn khu
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
            {dot.map((d) => {
              const t = trangThaiDot(d)
              return (
                <div key={d.thu_tu} className={cx('px-3.5 py-3')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[0.8125rem] font-medium text-ink">
                        Đợt {d.thu_tu}/{k.so_dot}
                      </span>
                      <span className="num text-[0.8125rem] text-muted"> · kỳ {kyVN(d.ky)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="num text-[0.8125rem] font-semibold text-ink">{vnd(d.so_tien)}</span>
                      <Pill tone={TONE_DOT[t]}>{NHAN_DOT[t]}</Pill>
                    </div>
                  </div>
                  <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{loiDot(d, kyVN)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      <Hop tone="trung" title="Vì sao không có nút trả riêng cho từng đợt">
        Mỗi đợt đã là một dòng trên hóa đơn tháng của bạn, nên bạn vẫn chuyển
        MỘT lần mỗi tháng như cũ, đúng mã QR cũ. Muốn trả sớm cho xong thì trả
        đủ hóa đơn của các kỳ đó khi chúng phát hành — không có khoản phạt nào
        cho việc trả đúng lịch, và cũng không có ưu đãi nào cho trả sớm.
      </Hop>
    </div>
  )
}
