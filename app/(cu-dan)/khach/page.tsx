import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong, cx, ngayGioVN } from '@/components/ui'
import { NHAN_TRANG_THAI, TONE_TRANG_THAI, khoangGio, nhanTrangThai } from '@/lib/khach'
import { FormMoi, NutThuHoi } from './form'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const homNay = new Date().toISOString().slice(0, 10)

  const { data: ms } = await db
    .from('unit_memberships')
    .select('unit_id, units(code, buildings(name))')
    .eq('status', 'active')
    .lte('valid_from', homNay)
    .or(`valid_to.is.null,valid_to.gte.${homNay}`)

  const canDs = (ms ?? []).map((m) => {
    const u = Array.isArray(m.units) ? m.units[0] : m.units
    const b = u && (Array.isArray(u.buildings) ? u.buildings[0] : u.buildings)
    return { id: m.unit_id, nhan: `${u?.code ?? '—'}${b ? ` · ${b.name}` : ''}` }
  })

  // Trạng thái tính Ở SQL (khach_cua_toi), không chép luật sang đây. Hai bản
  // chép tay của cùng một luật là hai bản sẽ lệch, và lệch ở đây nghĩa là cư
  // dân thấy "đang hiệu lực" cho một mã mà bảo vệ quét ra màn đỏ.
  const { data: ds, error } = await db.rpc('khach_cua_toi')

  return (
    <div className="space-y-5">
      <PageHead
        title="Khách thăm"
        sub="Tạo mã QR gửi trước cho khách — bảo vệ quét ở sảnh, không phải xuống đón"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách khách">
          {error.code === '42P01'
            ? 'Phần khách thăm chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {canDs.length === 0 ? (
        <Trong title="Chưa có căn hộ nào">
          Mời khách được khi bạn đã là thành viên của một căn hộ.
        </Trong>
      ) : (
        <Card>
          <CardHead title="Mời khách" />
          <div className="p-4"><FormMoi canDs={canDs} /></div>
        </Card>
      )}

      <Card>
        <CardHead title="Lượt khách gần đây" />
        {(ds ?? []).length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa mời ai">
              Mã tạo xong thì gửi cho khách qua Zalo. Khách đưa mã cho bảo vệ quét
              ở sảnh — không ai phải xuống đón.
            </Trong>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {(ds ?? []).map((k) => {
              const tt = k.trang_thai
              const conThuHoiDuoc = tt === 'dang_hieu_luc' || tt === 'chua_toi_gio'
              return (
                <div key={k.id} className={cx('px-4 py-3', tt === 'thu_hoi' && 'opacity-60')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/khach/${k.id}`} className="font-medium text-ink hover:underline">
                        {k.ho_ten}
                      </Link>
                      <div className="mt-0.5 text-[0.8125rem] text-muted">
                        {k.can} · {khoangGio(k.hieu_luc_tu, k.hieu_luc_den)}
                      </div>
                      {k.vao_luc && (
                        <div className="num mt-0.5 text-[0.75rem] text-faint">
                          Vào {ngayGioVN(k.vao_luc)}
                          {k.ra_luc ? ` · ra ${ngayGioVN(k.ra_luc)}` : ' · chưa quét ra'}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Pill tone={TONE_TRANG_THAI[tt] ?? 'trung'}>{nhanTrangThai(tt)}</Pill>
                      {conThuHoiDuoc && <NutThuHoi id={k.id} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Nói ra là có sổ, và giữ bao lâu. Dựng một cuốn sổ ghi ai tới thăm ai mà
          không nói với người bị ghi là dựng lén. */}
      <Hop tone="trung" title="Ban quản lý thấy gì, và giữ bao lâu">
        Bảo vệ thấy tên khách, số điện thoại bạn điền, căn được thăm và giờ ra
        vào — đúng những gì cuốn sổ giấy ở sảnh đang ghi. Sổ này{' '}
        <strong>chỉ ghi khách</strong>, không ghi lượt ra vào của cư dân. Mỗi lượt
        được xóa sau <strong>90 ngày</strong>.
        {' '}Trạng thái: {Object.values(NHAN_TRANG_THAI).slice(0, 3).join(' · ')}.
      </Hop>
    </div>
  )
}
