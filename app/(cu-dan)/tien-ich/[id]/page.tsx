import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, cx, ngayVN, vnd } from '@/components/ui'
import { LichSuat, type ONgay } from '@/components/lich-suat'
import { loiConSuat, loiOKhongDat, nhanSuat, type OSuat } from '@/lib/tien-ich'
import { NutDat, NutHuy } from './form'

export const dynamic = 'force-dynamic'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const hopLe = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ngay?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const db = await createClient()

  const { data: t } = await db
    .from('tien_ich')
    .select('id, ten, mo_ta, dia_diem, phi, toi_da_tuan, dat_truoc_ngay, dang_mo')
    .eq('id', id)
    .maybeSingle()
  if (!t) notFound()

  const homNay = new Date()
  const tu = iso(homNay)
  const den = iso(new Date(homNay.getTime() + t.dat_truoc_ngay * 86_400_000))
  const chon = hopLe(sp.ngay) ?? tu

  const [{ data: lich, error }, { data: cs }] = await Promise.all([
    db.rpc('lich_tien_ich', { p_tien_ich: id, p_tu: tu, p_den: den }),
    db.rpc('con_suat_tuan', { p_tien_ich: id, p_ngay: chon }),
  ])

  // Gom ô theo ngày. lich_tien_ich đã vẽ đủ lưới nên ngày trống vẫn có mặt.
  const theoNgay = new Map<string, OSuat[]>()
  for (const r of lich ?? []) {
    const arr = theoNgay.get(r.ngay) ?? []
    arr.push(r as OSuat)
    theoNgay.set(r.ngay, arr)
  }
  const ngayDs: ONgay[] = [...theoNgay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ngay, o]) => ({ ngay, o }))

  // Ngày ngoài cửa sổ đặt: đến được bằng cách sửa ?ngay= trên URL, hoặc mở một
  // link ai đó gửi từ tuần trước. Nói đúng lý do thay vì "ngày này không có
  // suất nào" — câu đó khiến người ta tưởng tiện ích không mở ngày đó.
  const ngoaiCua = chon < tu || chon > den
  const oCuaNgay = ngoaiCua ? [] : (theoNgay.get(chon) ?? [])
  const q = cs?.[0]
  const hanMuc = loiConSuat(q?.da_dat ?? 0, q?.toi_da ?? t.toi_da_tuan, q?.con_lai ?? 0)

  // Lượt của chính căn mình trong ngày đang xem — để hiện nút hủy.
  const { data: cuaToi } = await db
    .from('dat_tien_ich')
    .select('id, suat_id, ngay')
    .eq('tien_ich_id', id)
    .is('huy_luc', null)
    .gte('ngay', tu)
  const idTheoSuat = new Map((cuaToi ?? []).map((d) => [`${d.suat_id}|${d.ngay}`, d.id]))

  return (
    <div className="space-y-5">
      <Link href="/tien-ich" className="inline-block text-[0.8125rem] font-medium text-muted hover:text-ink">
        ← Tiện ích
      </Link>

      <PageHead
        title={t.ten}
        sub={[t.dia_diem, t.phi > 0 ? `${vnd(t.phi)} một suất` : 'Miễn phí'].filter(Boolean).join(' · ')}
        actions={t.dang_mo ? undefined : <Pill tone="trung">Đang đóng</Pill>}
      />

      {error && (
        <Hop tone="xau" title="Không đọc được lịch">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần tiện ích chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {/* Hạn mức hiện TRƯỚC lịch. Để nó sau, dưới dạng một lỗi khi bấm, thì
          người ta chọn ngày, chọn giờ, bấm, rồi mới biết là không được. */}
      <Hop tone={hanMuc.ok ? 'trung' : 'canh'} title="Hạn mức tuần này">{hanMuc.loi}</Hop>

      <Card>
        <CardHead title="Chọn ngày" sub={`Mở đặt trước ${t.dat_truoc_ngay} ngày`} />
        <div className="p-4">
          <LichSuat ngayDs={ngayDs} base={`/tien-ich/${id}`} dangChon={chon} phi={t.phi} />
        </div>
      </Card>

      <Card>
        <CardHead title={`Suất ngày ${ngayVN(chon)}`} />
        {ngoaiCua ? (
          <p className="p-4 text-[0.8125rem] text-muted">
            {chon < tu
              ? 'Ngày này đã qua.'
              : `Chưa mở đặt cho ngày này — chỉ đặt trước được ${t.dat_truoc_ngay} ngày.`}{' '}
            Chọn một ngày trên lịch ở trên.
          </p>
        ) : oCuaNgay.length === 0 ? (
          <p className="p-4 text-[0.8125rem] text-muted">Ngày này không có suất nào.</p>
        ) : (
          <div className="divide-y divide-line">
            {oCuaNgay.map((o) => {
              const ly = loiOKhongDat(o, hanMuc.ok, false)
              const idDat = idTheoSuat.get(`${o.suat_id}|${chon}`)
              return (
                <div key={o.suat_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className={cx('num font-medium', o.con_trong ? 'text-ink' : 'text-muted')}>
                      {nhanSuat(o.bat_dau, o.ket_thuc)}
                    </div>
                    {ly && <div className="mt-0.5 text-[0.8125rem] text-muted">{ly}</div>}
                  </div>
                  <div className="shrink-0">
                    {o.cua_toi && idDat ? (
                      <NutHuy id={idDat} />
                    ) : ly ? (
                      <Pill tone={o.dong_cua ? 'trung' : 'xau'}>{o.dong_cua ? 'Đóng' : 'Kín'}</Pill>
                    ) : (
                      <NutDat suat={o.suat_id} ngay={chon} nhan={nhanSuat(o.bat_dau, o.ket_thuc)} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Hop tone="trung" title="Ai bấm trước thì được">
        Suất giữ ngay lúc bấm, không phải chờ ai duyệt. Hủy được cho tới lúc suất
        bắt đầu, và chỗ trả lại ngay cho người khác đặt — nên hủy sớm khi biết
        mình không dùng nữa.
      </Hop>
    </div>
  )
}
