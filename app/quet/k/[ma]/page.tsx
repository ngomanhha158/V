import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { cx, ngayGioVN } from '@/components/ui'
import { khoangGio, nhanTrangThai, viecPhaiLam } from '@/lib/khach'
import { NutGhiSo } from './nut'

/**
 * Màn bảo vệ quét mã khách.
 *
 * Quét bằng app camera có sẵn, y như thẻ cư dân — không cài gì, không phụ thuộc
 * BarcodeDetector. Bỏ hẳn vỏ app: bảo vệ nhìn màn này nửa giây ở cửa với hàng
 * người đang chờ, thanh nav chiếm mất chỗ quý nhất trên điện thoại.
 *
 * MỞ TRANG NÀY KHÔNG GHI VÀO SỔ. Bảo vệ soi mã trước khi mở cửa; ghi giờ ngay
 * lúc soi thì sổ ghi sai giờ, và ghi cả những lượt cuối cùng không vào. Ghi là
 * một cú bấm riêng.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ ma: string }> }) {
  const { ma } = await params
  const db = await createClient()
  const { data, error } = await db.rpc('quet_khach', { p_ma: ma, p_ghi: false })
  const k = data?.[0]

  if (error || !k) {
    const cam = error?.code === '42501'
    return (
      <Khung ok={false} tieu={cam ? 'KHÔNG CÓ QUYỀN QUÉT' : 'KHÔNG QUÉT ĐƯỢC'}>
        {cam
          ? 'Tài khoản đang đăng nhập không phải nhân sự của dự án này. Đăng nhập bằng tài khoản trực ban rồi quét lại.'
          : (error?.message ?? 'Không đọc được mã.')}
      </Khung>
    )
  }

  const viec = viecPhaiLam(k.trang_thai)

  if (!k.cho_vao) {
    return (
      <Khung ok={false} tieu="KHÔNG CHO VÀO" phu={nhanTrangThai(k.trang_thai)}>
        <p className="font-medium text-ink">{k.loi}</p>
        {viec && <p className="mt-1.5">{viec}</p>}
        {k.ho_ten && (
          <p className="mt-3 text-[0.8125rem] text-faint">
            Mã này của {k.ho_ten} · căn {k.can}
            {k.hieu_luc_tu && k.hieu_luc_den && ` · hẹn ${khoangGio(k.hieu_luc_tu, k.hieu_luc_den)}`}
          </p>
        )}
      </Khung>
    )
  }

  const daVao = !!k.vao_luc
  return (
    <div className="mx-auto max-w-md p-4 pb-10">
      <div className="rounded-card bg-ok px-5 py-6 text-center text-white">
        <p className="text-[1.75rem] leading-tight font-extrabold tracking-tight">
          {daVao ? 'ĐANG TRONG TÒA' : 'CHO VÀO'}
        </p>
        <p className="mt-1.5 text-[0.9375rem] leading-snug opacity-95">
          Khách của căn {k.can}
        </p>
      </div>

      <div className="mt-3 rounded-card border border-line bg-surface p-4">
        <p className="text-[1.25rem] leading-tight font-bold text-ink">{k.ho_ten}</p>
        {k.dien_thoai && (
          <a href={`tel:${k.dien_thoai}`} className="num text-sm font-medium text-brand">
            {k.dien_thoai}
          </a>
        )}
        <dl className="mt-3 divide-y divide-line text-sm">
          <Dong nhan="Căn hộ" giatri={`${k.can}${k.toa ? ` · ${k.toa}` : ''}`} />
          <Dong nhan="Người mời" giatri={k.nguoi_moi ?? '—'} />
          {k.hieu_luc_tu && k.hieu_luc_den && (
            <Dong nhan="Hẹn" giatri={khoangGio(k.hieu_luc_tu, k.hieu_luc_den)} />
          )}
          {k.ly_do && <Dong nhan="Lý do" giatri={k.ly_do} />}
          <Dong nhan="Vào lúc" giatri={k.vao_luc ? ngayGioVN(k.vao_luc) : '—'} />
          <Dong nhan="Ra lúc" giatri={k.ra_luc ? ngayGioVN(k.ra_luc) : '—'} />
        </dl>
      </div>

      {/* Nút ghi sổ là một cú bấm RIÊNG. Mở trang không ghi gì, nên bảo vệ soi
          thử thoải mái — kể cả những lượt cuối cùng khách không vào. */}
      <div className="mt-3">
        <NutGhiSo ma={ma} daVao={daVao} hoTen={k.ho_ten ?? ''} />
      </div>


      {/* Bước duy nhất hệ thống không làm thay được. Màn thẻ cư dân có ảnh để
          đối chiếu; ở đây không có ảnh khách, nên đối chiếu bằng tên. Không
          nói ra thì "màn xanh" bị hiểu là "cho qua, khỏi hỏi". */}
      <p className="mt-4 rounded-card border border-line bg-raised px-3.5 py-3 text-[0.8125rem] leading-relaxed text-muted">
        Màn xanh chỉ nói <strong className="text-ink">mã này hợp lệ</strong>. Hỏi
        tên người đứng trước bạn xem có khớp{' '}
        <strong className="text-ink">{k.ho_ten}</strong> không — đây là bước hệ
        thống không làm thay được, và mã khách thì gửi qua Zalo nên chuyển tiếp
        cho ai cũng được.
      </p>

      <p className="mt-4 text-[0.8125rem]">
        <Link href="/quet" className="font-medium text-brand hover:underline">Hướng dẫn quét</Link>
      </p>
    </div>
  )
}

function Khung({
  ok, tieu, phu, children,
}: { ok: boolean; tieu: string; phu?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md p-4 pb-10">
      <div className={cx('rounded-card px-5 py-6 text-center text-white', ok ? 'bg-ok' : 'bg-bad')}>
        <p className="text-[1.75rem] leading-tight font-extrabold tracking-tight">{tieu}</p>
        {phu && <p className="mt-1.5 text-[0.9375rem] leading-snug opacity-95">{phu}</p>}
      </div>
      <div className="mt-3 rounded-card border border-line bg-surface p-4 text-[0.875rem] leading-relaxed text-muted">
        {children}
      </div>
      <p className="mt-4 text-[0.8125rem]">
        <Link href="/quet" className="font-medium text-brand hover:underline">Hướng dẫn quét</Link>
      </p>
    </div>
  )
}

function Dong({ nhan, giatri }: { nhan: string; giatri: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{nhan}</dt>
      <dd className="text-right font-medium text-ink">{giatri}</dd>
    </div>
  )
}
