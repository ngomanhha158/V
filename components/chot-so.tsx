import { Card, CardHead, Hop, Pill, cx, ngayGioVN, ngayVN, vnd } from '@/components/ui'
import {
  NHAN_TRANG_THAI, TONE_TRANG_THAI, loiHieuLuc, loiLechQuy, loiTyLeNo, trangThaiChot,
} from '@/lib/ban-giao'

export type BanChot = {
  id: string
  ngay_chot: string
  so_can: number
  so_can_no: number
  tong_phai_thu: number
  qua_han_90: number
  quy_bao_tri: number
  quy_doi_chieu: number | null
  audit_den: number | null
  lap_luc: string
  ky_bql_luc: string | null
  ky_bqt_luc: string | null
  huy_luc: string | null
  ly_do_huy: string | null
  ghi_chu: string | null
}

/**
 * Một bản chốt bàn giao. MỘT thành phần cho cả màn BQL lẫn màn cư dân — khác
 * nhau đúng ở chỗ màn BQL truyền thêm nút.
 *
 * Trạng thái ký hiện TRƯỚC các con số. Một bản mới lập và một bản hai bên đã ký
 * trông giống hệt nhau nếu chỉ nhìn số, mà chúng khác nhau hoàn toàn: một cái
 * là bản nháp, cái kia là thỏa thuận đã ký.
 */
export function ChotSo({ c, hanhDong }: { c: BanChot; hanhDong?: React.ReactNode }) {
  const t = trangThaiChot(c)
  const hl = loiHieuLuc(t, c.ly_do_huy)
  const tl = loiTyLeNo(c.so_can_no, c.so_can)
  const lq = loiLechQuy(c.quy_bao_tri, c.quy_doi_chieu)

  return (
    <Card className={c.huy_luc ? 'opacity-70' : undefined}>
      <CardHead
        title={`Chốt sổ ngày ${ngayVN(c.ngay_chot)}`}
        sub={c.ghi_chu ?? undefined}
        right={<Pill tone={TONE_TRANG_THAI[t]}>{NHAN_TRANG_THAI[t]}</Pill>}
      />

      <div className="px-4 pt-3">
        <Hop tone={hl.ok ? 'tot' : t === 'da_huy' ? 'trung' : 'canh'} title={hl.tieu}>
          {hl.than}
        </Hop>
      </div>

      <dl className="divide-y divide-line px-4 text-sm">
        <Dong nhan="Căn có công nợ" giatri={`${c.so_can_no} / ${c.so_can}`} phu={tl.loi} tone={tl.muc} />
        <Dong nhan="Tổng phải thu" giatri={vnd(c.tong_phai_thu)} manh />
        <Dong
          nhan="Quá hạn trên 90 ngày"
          giatri={vnd(c.qua_han_90)}
          phu="Tính từ NGÀY CHỐT, không phải từ hôm nay."
        />
        <Dong nhan="Số dư quỹ bảo trì" giatri={vnd(c.quy_bao_tri)} manh />
        <Dong
          nhan="Ngân hàng báo"
          giatri={c.quy_doi_chieu == null ? '—' : vnd(c.quy_doi_chieu)}
          phu={lq.loi}
          tone={lq.ok ? 'tot' : 'canh'}
        />
      </dl>

      <div className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
        Lập lúc {ngayGioVN(c.lap_luc)}
        {c.ky_bql_luc && ` · BQL ký ${ngayGioVN(c.ky_bql_luc)}`}
        {c.ky_bqt_luc && ` · BQT ký ${ngayGioVN(c.ky_bqt_luc)}`}
        {/* Neo kiểm toán: nói ra để bản chốt gắn được vào một thứ kiểm chứng
            lại được, chứ không chỉ là một tờ giấy nói về quá khứ. */}
        {c.audit_den != null && ` · ứng với nhật ký kiểm toán tới bút toán #${c.audit_den}`}
      </div>

      {hanhDong && <div className="border-t border-line p-4">{hanhDong}</div>}
    </Card>
  )
}

function Dong({
  nhan, giatri, phu, manh, tone,
}: {
  nhan: string; giatri: string; phu?: string; manh?: boolean
  tone?: 'tot' | 'canh' | 'xau' | 'trung'
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted">{nhan}</dt>
        <dd className={cx('num text-right font-medium text-ink', manh && 'text-[1.0625rem]')}>
          {giatri}
        </dd>
      </div>
      {phu && (
        <p
          className={cx(
            'mt-0.5 text-[0.75rem] leading-relaxed',
            tone === 'xau' ? 'text-bad' : tone === 'canh' ? 'text-warn' : 'text-faint',
          )}
        >
          {phu}
        </p>
      )}
    </div>
  )
}
