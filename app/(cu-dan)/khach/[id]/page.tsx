import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { headers } from 'next/headers'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, ngayGioVN } from '@/components/ui'
import { TONE_TRANG_THAI, khoangGio, loiMoi, nhanTrangThai } from '@/lib/khach'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const { data: k } = await db
    .from('khach_tham')
    .select('id, ho_ten, dien_thoai, ly_do, ma, hieu_luc_tu, hieu_luc_den, thu_hoi_luc, vao_luc, ra_luc, units(code, buildings(name))')
    .eq('id', id)
    .maybeSingle()
  if (!k) notFound()

  const u = Array.isArray(k.units) ? k.units[0] : k.units
  const b = u && (Array.isArray(u.buildings) ? u.buildings[0] : u.buildings)

  const bay = Date.now()
  const tt = k.thu_hoi_luc ? 'thu_hoi'
    : k.ra_luc ? 'da_ra'
    : k.vao_luc ? 'trong_toa'
    : bay < new Date(k.hieu_luc_tu).getTime() ? 'chua_toi_gio'
    : bay > new Date(k.hieu_luc_den).getTime() ? 'het_han'
    : 'dang_hieu_luc'

  const h = await headers()
  const goc = `https://${h.get('host') ?? 'localhost'}`
  const link = `${goc}/quet/k/${k.ma}`

  // Mã QR chỉ dựng khi còn dùng được. Hiện một mã đã chết là mời cư dân gửi cho
  // khách một thứ sẽ bị từ chối ở cửa.
  const conDung = tt === 'dang_hieu_luc' || tt === 'chua_toi_gio' || tt === 'trong_toa'
  const anh = conDung
    ? await QRCode.toDataURL(link, { width: 560, margin: 0, color: { dark: '#101828', light: '#ffffff' } })
    : null

  return (
    <div className="space-y-5">
      <Link href="/khach" className="inline-block text-[0.8125rem] font-medium text-muted hover:text-ink">
        ← Khách thăm
      </Link>

      <PageHead
        title={`Khách của ${u?.code ?? ''}`}
        sub={`${k.ho_ten}${k.dien_thoai ? ` · ${k.dien_thoai}` : ''}`}
        actions={<Pill tone={TONE_TRANG_THAI[tt] ?? 'trung'}>{nhanTrangThai(tt)}</Pill>}
      />

      {anh ? (
        <Card>
          <CardHead
            title="Mã cho khách"
            sub={`Hiệu lực ${khoangGio(k.hieu_luc_tu, k.hieu_luc_den)}`}
          />
          <div className="space-y-3 p-4">
            {/* Nền trắng cố định quanh mã: máy quét cần tương phản tối-trên-sáng,
                để mã lọt vào nền tối là điện thoại bảo vệ không đọc ra. */}
            <div className="flex justify-center">
              <div className="rounded-xl border border-line bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={anh} alt="Mã QR khách thăm" className="w-[17rem] max-w-full" />
              </div>
            </div>
            {/* Link chữ đứng cạnh mã ảnh: gửi qua Zalo thì ảnh mờ, còn chữ thì
                copy được và không hỏng. */}
            <div className="rounded-card bg-sunken px-3 py-2">
              <p className="text-[0.75rem] text-muted">Gửi cho khách</p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed break-all text-ink">
                {loiMoi(k.ho_ten, u?.code ?? '', b?.name ?? '', k.hieu_luc_tu, k.hieu_luc_den)}
              </p>
              <p className="mt-1 text-[0.8125rem] break-all text-brand">{link}</p>
            </div>
          </div>
        </Card>
      ) : (
        <Hop tone="xau" title={`Mã không dùng được nữa — ${nhanTrangThai(tt)}`}>
          {tt === 'thu_hoi'
            ? 'Bạn đã thu hồi lượt này. Muốn mời lại thì tạo một mã mới.'
            : tt === 'het_han'
              ? 'Đã quá khung giờ hẹn. Tạo mã mới với khung giờ khác.'
              : 'Lượt này đã ra khỏi tòa, mã dùng xong rồi. Muốn vào lại thì tạo mã mới.'}
        </Hop>
      )}

      <Card>
        <CardHead title="Sổ ra vào của lượt này" />
        <dl className="divide-y divide-line px-4 text-sm">
          <Dong nhan="Căn hộ" giatri={`${u?.code ?? '—'}${b ? ` · ${b.name}` : ''}`} />
          {k.ly_do && <Dong nhan="Lý do" giatri={k.ly_do} />}
          <Dong nhan="Vào lúc" giatri={k.vao_luc ? ngayGioVN(k.vao_luc) : '—'} />
          <Dong
            nhan="Ra lúc"
            giatri={k.ra_luc ? ngayGioVN(k.ra_luc) : k.vao_luc ? 'chưa quét ra' : '—'}
          />
        </dl>
        {k.vao_luc && !k.ra_luc && (
          <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
            Khách quên quét lúc về là chuyện thường. Hệ thống để trống chứ không
            đoán giờ ra — một giờ đoán bừa còn tệ hơn một ô trống.
          </p>
        )}
      </Card>
    </div>
  )
}

function Dong({ nhan, giatri }: { nhan: string; giatri: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{nhan}</dt>
      <dd className="text-right font-medium text-ink">{giatri}</dd>
    </div>
  )
}
