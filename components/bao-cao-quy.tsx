import { Card, CardHead, Hop, Pill, cx, ngayGioVN, ngayVN, vnd } from '@/components/ui'
import { chiSoChinh, phanTram, quyTruoc, soVoiQuyTruoc, tenQuy, tyLe, type BaoCao } from '@/lib/bao-cao'

export type BanBaoCao = BaoCao & {
  id: string
  lap_luc: string
  nguoi_lap: string | null
  audit_den: number | null
  huy_luc: string | null
  ly_do_huy: string | null
}

/**
 * Một bản báo cáo quý, dùng chung ở màn BQL và màn cư dân.
 *
 * Cùng một khối cho cả hai bên là cố ý: cư dân đọc ĐÚNG con số mà ban quản trị
 * mang ra họp. Hai bản diễn giải khác nhau cho cùng một quý là thứ sinh ra tranh
 * cãi ở hội nghị.
 */
export function BaoCaoQuy({
  b, truoc, hanhDong,
}: { b: BanBaoCao; truoc: BanBaoCao | null; hanhDong?: React.ReactNode }) {
  const chi = chiSoChinh(b)
  const xu = soVoiQuyTruoc(b, truoc)
  const daHuy = !!b.huy_luc

  return (
    <Card className={cx(daHuy && 'opacity-70')}>
      <CardHead
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{tenQuy(b.nam, b.quy)}</span>
            {daHuy && <Pill tone="trung">Đã hủy</Pill>}
          </span>
        }
        sub={`${ngayVN(b.tu_ngay)} – ${ngayVN(b.den_ngay)} · lập ${ngayGioVN(b.lap_luc)}${b.nguoi_lap ? ` bởi ${b.nguoi_lap}` : ''}`}
      />
      <div className="space-y-4 p-4">
        {daHuy && (
          <Hop tone="trung" title="Bản này đã hủy">
            Lý do: {b.ly_do_huy?.trim() || 'không ghi'}. Bản vẫn nằm lại vì biên bản
            họp cũ còn trỏ vào nó — nhưng đừng dùng số ở đây để đối chiếu nữa.
          </Hop>
        )}

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {chi.map((c) => (
            <div key={c.khoa} className="rounded-card border border-line bg-sunken px-3.5 py-3">
              <dt className="text-[0.75rem] font-medium text-muted">{c.nhan}</dt>
              <dd className={cx(
                'num mt-1 text-[1.375rem] leading-none font-semibold',
                c.tone === 'xau' ? 'text-bad' : c.tone === 'canh' ? 'text-warn'
                  : c.tone === 'tot' ? 'text-ok' : 'text-ink',
              )}>
                {c.gia_tri}
              </dd>
              {c.phu && <dd className="num mt-1.5 text-[0.75rem] text-faint">{c.phu}</dd>}
            </div>
          ))}
        </dl>

        {xu && <Hop tone="trung">{xu.loi}</Hop>}

        <div className="grid gap-x-6 gap-y-1.5 text-[0.8125rem] sm:grid-cols-2">
          <Dong nhan="Căn hộ" gia={`${b.so_can} căn`} />
          <Dong nhan="Căn đang nợ cuối quý"
                gia={`${b.so_can_no} căn · ${vnd(b.cong_no_cuoi_quy)}`}
                canh={tyLe(b.so_can_no, b.so_can) >= 15} />
          <Dong nhan="Quỹ bảo trì đầu quý" gia={vnd(b.quy_bao_tri_dau)} />
          <Dong nhan="Quỹ bảo trì cuối quý" gia={vnd(b.quy_bao_tri_cuoi)} />
          <Dong nhan="Chi vật tư trong quý" gia={vnd(b.chi_vat_tu)} />
          <Dong nhan="Đăng ký thi công" gia={`${b.so_thi_cong} lượt`} />
          <Dong nhan="Biên bản bàn giao ca" gia={`${b.so_ban_giao_ca} biên bản`} />
          <Dong nhan="Biên bản chưa ký nhận"
                gia={`${b.so_ban_giao_chua_ky} biên bản`}
                canh={b.so_ban_giao_chua_ky > 0} />
        </div>

        <p className="text-[0.75rem] leading-relaxed text-faint">
          Mọi con số ở đây được ĐÓNG BĂNG lúc lập báo cáo. Dữ liệu gốc đổi về sau
          — tiền về muộn, yêu cầu đóng thêm — cũng không làm đổi bản này, để biên
          bản họp và báo cáo nói cùng một con số mãi mãi.
          {b.audit_den != null && (
            <> Neo vào nhật ký kiểm toán tới bút toán <span className="num">#{b.audit_den}</span>.</>
          )}
        </p>

        {hanhDong}
      </div>
    </Card>
  )
}

function Dong({ nhan, gia, canh }: { nhan: string; gia: string; canh?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1">
      <span className="text-muted">{nhan}</span>
      <span className={cx('num font-medium', canh ? 'text-warn' : 'text-ink')}>{gia}</span>
    </div>
  )
}

/** Bản của quý liền trước, để so xu hướng. Không có thì trả null — không bịa. */
export function timQuyTruoc(b: BanBaoCao, tatCa: BanBaoCao[]): BanBaoCao | null {
  const t = quyTruoc(b.nam, b.quy)
  return tatCa.find((x) => x.nam === t.nam && x.quy === t.quy && !x.huy_luc) ?? null
}

export { phanTram }
