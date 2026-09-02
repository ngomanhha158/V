import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import {
  coLoc, dieuKien, docLoc, queryLoc, taLoc, TEN_TINH_TRANG, tenLoai, type ThamSo,
} from '@/lib/can-ho'
import {
  Bang, Card, CardHead, Hop, PageHead, Pill, Stat, Td, Th, Tr, Trong,
} from '@/components/ui'
import { ODienTich, FormHangLoat } from './form'

export const dynamic = 'force-dynamic'

const MOI_TRANG = 100

export default async function CanHo({
  searchParams,
}: { searchParams: Promise<ThamSo & { trang?: string }> }) {
  const sp = await searchParams
  const db = await createClient()

  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào trong hệ thống" />

  // Guard hiển thị. Chốt chặn thật là RLS (policy unit_staff_write).
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const { data: toaNha } = await db
    .from('buildings').select('id, code, name').eq('project_id', project.id).order('code')
  const theoMa = new Map((toaNha ?? []).map((b) => [b.code.toUpperCase(), b.id]))
  const loc = docLoc(sp, theoMa)
  const dk = dieuKien(loc)

  const trang = Math.max(1, Number(sp.trang) || 1)
  const tu = (trang - 1) * MOI_TRANG

  // Cùng một chuỗi điều kiện áp lên ba truy vấn khác nhau. Viết thành vòng lặp
  // thay vì chép ba lần: chép là sớm muộn cũng lệch, mà lệch ở đây nghĩa là con
  // số trên nút áp hàng loạt không còn đúng với tập bị sửa.
  let qTrang = db
    .from('units')
    .select('id, code, floor_no, area_m2, kind, state, building_id', { count: 'exact' })
  let qDaCo = db.from('units').select('id', { count: 'exact', head: true })
  for (const d of dk) {
    if (d.kieu === 'trongDuAn') { qTrang = qTrang.in('building_id', d.ids); qDaCo = qDaCo.in('building_id', d.ids) }
    else if (d.kieu === 'toa') { qTrang = qTrang.eq('building_id', d.gt); qDaCo = qDaCo.eq('building_id', d.gt) }
    else if (d.kieu === 'tang') { qTrang = qTrang.eq('floor_no', d.gt); qDaCo = qDaCo.eq('floor_no', d.gt) }
    else if (d.kieu === 'ma') { qTrang = qTrang.ilike('code', d.mau); qDaCo = qDaCo.ilike('code', d.mau) }
    else { qTrang = qTrang.is('area_m2', null); qDaCo = qDaCo.is('area_m2', null) }
  }

  const dsToa = [...theoMa.values()]
  const [khop, daCo, tong, thieu] = await Promise.all([
    qTrang.order('floor_no').order('code').order('id').range(tu, tu + MOI_TRANG - 1),
    qDaCo.not('area_m2', 'is', null),
    db.from('units').select('id', { count: 'exact', head: true }).in('building_id', dsToa),
    db.from('units').select('id', { count: 'exact', head: true })
      .in('building_id', dsToa).is('area_m2', null),
  ])

  const ds = khop.data ?? []
  const soKhop = khop.count ?? 0
  const soDaCo = daCo.count ?? 0
  const tongCan = tong.count ?? 0
  const soThieu = thieu.count ?? 0
  const soTrang = Math.max(1, Math.ceil(soKhop / MOI_TRANG))
  const tenToa = new Map((toaNha ?? []).map((b) => [b.id, b.code]))

  return (
    <div className="space-y-5">
      <PageHead
        title="Căn hộ"
        sub={`${project.name} · ${tongCan} căn`}
        actions={soThieu === 0 && tongCan > 0
          ? <Pill tone="tot">Đủ diện tích</Pill>
          : <Pill tone="canh">{soThieu} căn thiếu diện tích</Pill>}
      />

      {soThieu > 0 && (
        <Hop tone="canh" title="Thiếu diện tích thì phí theo m² ra 0 đồng">
          Hóa đơn vẫn phát bình thường, chỉ là mọi dòng phí tính theo mét vuông đều
          bằng <strong>0 đồng</strong> — không có thông báo lỗi nào cả. Nhập diện tích ở đây
          trước khi tạo phí <strong>theo m²</strong> ở màn{' '}
          <Link href="/bql/bieu-phi" className="font-semibold underline">Biểu phí</Link>.
          <br /><br />
          Màn <strong>Nhập từ Excel</strong> không sửa được chỗ này: nó chỉ thêm căn mới và
          từ chối mã căn đã có trong hệ thống.
        </Hop>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat nhan="Tổng căn" so={tongCan} />
        <Stat nhan="Đã có diện tích" so={tongCan - soThieu} tone={soThieu ? 'trung' : 'tot'} />
        <Stat nhan="Chưa có diện tích" so={soThieu} tone={soThieu ? 'canh' : 'trung'} />
        <Stat nhan="Đang lọc" so={soKhop} phu={coLoc(loc) ? taLoc(loc) : 'không lọc gì'} />
      </div>

      <Card>
        <CardHead title="Lọc" sub="Bộ lọc này quyết định luôn tập bị sửa khi áp hàng loạt" />
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <label className="block w-40">
            <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Tòa</span>
            <select
              name="toa" defaultValue={loc.toa}
              className="h-10 w-full rounded-ctl border border-line-firm bg-surface px-3 text-sm text-ink focus:border-brand"
            >
              <option value="">Mọi tòa</option>
              {(toaNha ?? []).map((b) => (
                <option key={b.id} value={b.code}>{b.code} · {b.name}</option>
              ))}
            </select>
          </label>

          <label className="block w-24">
            <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Tầng</span>
            <input
              name="tang" inputMode="numeric" placeholder="mọi tầng"
              defaultValue={loc.tang === null ? '' : String(loc.tang)}
              className="num h-10 w-full rounded-ctl border border-line-firm bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-brand"
            />
          </label>

          <label className="block w-48">
            <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Mã căn chứa</span>
            <input
              name="ma" placeholder=".01" defaultValue={loc.ma}
              className="h-10 w-full rounded-ctl border border-line-firm bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-brand"
            />
          </label>

          <label className="flex h-10 items-center gap-2 text-[0.8125rem] text-muted">
            <input
              type="checkbox" name="thieu" value="1" defaultChecked={loc.chuaCo}
              className="size-4 accent-brand"
            />
            Chỉ căn chưa có diện tích
          </label>

          <button
            type="submit"
            className="h-10 rounded-ctl border border-transparent bg-brand px-3.5 text-sm font-medium text-on-brand hover:bg-brand-deep"
          >
            Lọc
          </button>
          {coLoc(loc) && (
            <Link
              href="/bql/can-ho"
              className="flex h-10 items-center px-2 text-[0.8125rem] font-medium text-muted hover:text-ink"
            >
              Bỏ lọc
            </Link>
          )}
        </form>
      </Card>

      <Card>
        <CardHead
          title="Đặt diện tích hàng loạt"
          sub="Cách duy nhất khả thi cho vài trăm căn — nhưng cũng là cách nhanh nhất để hỏng hàng loạt, nên đọc kỹ dòng phạm vi"
        />
        {soKhop === 0 ? (
          <div className="p-4">
            <Trong title="Bộ lọc hiện không khớp căn nào">Nới bộ lọc rồi thử lại.</Trong>
          </div>
        ) : (
          <FormHangLoat
            soCan={soKhop} pham={taLoc(loc)} soDaCo={soDaCo}
            toa={loc.toa} tang={loc.tang === null ? '' : String(loc.tang)}
            ma={loc.ma} thieu={loc.chuaCo ? '1' : ''}
          />
        )}
      </Card>

      <Card>
        <CardHead
          title="Danh sách căn"
          sub={soTrang > 1 ? `Trang ${trang}/${soTrang} · ${MOI_TRANG} căn mỗi trang` : undefined}
          right={<span className="text-[0.8125rem] text-faint">{soKhop}</span>}
        />
        {khop.error ? (
          <div className="p-4">
            <Hop tone="xau" title="Không đọc được danh sách căn">{khop.error.message}</Hop>
          </div>
        ) : ds.length === 0 ? (
          <div className="p-4">
            <Trong title="Không có căn nào khớp">
              {tongCan === 0
                ? 'Khu chưa có căn hộ nào. Tạo tòa ở màn Tòa nhà rồi import danh sách căn từ Excel.'
                : 'Đổi hoặc bỏ bộ lọc để thấy các căn khác.'}
            </Trong>
          </div>
        ) : (
          <>
            <Bang>
              <thead>
                <tr>
                  <Th>Mã căn</Th>
                  <Th>Tòa</Th>
                  <Th phai>Tầng</Th>
                  <Th>Loại</Th>
                  <Th>Tình trạng</Th>
                  <Th>Diện tích (m²)</Th>
                </tr>
              </thead>
              <tbody>
                {ds.map((u) => {
                  const tt = TEN_TINH_TRANG[u.state]
                  return (
                    <Tr key={u.id}>
                      <Td className="font-medium text-ink whitespace-nowrap">{u.code}</Td>
                      <Td className="text-muted">{tenToa.get(u.building_id) ?? '—'}</Td>
                      <Td phai so>{u.floor_no}</Td>
                      <Td className="text-muted">{tenLoai(u.kind)}</Td>
                      <Td>
                        {tt ? <Pill tone={tt.tone}>{tt.nhan}</Pill> : <span className="text-muted">{u.state}</span>}
                      </Td>
                      <Td>
                        {/* key gắn cả giá trị đã lưu: ô nhập giữ state riêng, mà
                            state thì không tự bám theo props mới. Sau khi áp hàng
                            loạt, không đổi key là cả cột vẫn hiện số cũ trong khi
                            database đã đổi — người dùng tin vào cái đang nhìn. */}
                        <ODienTich
                          key={`${u.id}:${u.area_m2 ?? ''}`}
                          id={u.id} ma={u.code}
                          dienTich={u.area_m2 === null ? null : Number(u.area_m2)}
                        />
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Bang>

            {soTrang > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                <span className="text-[0.8125rem] text-faint">
                  Căn {tu + 1}–{Math.min(tu + MOI_TRANG, soKhop)} trên {soKhop}
                </span>
                <div className="flex gap-2">
                  <TrangLink
                    href={`/bql/can-ho${queryLoc(loc, { trang: String(trang - 1) })}`}
                    tat={trang <= 1}
                  >
                    Trước
                  </TrangLink>
                  <TrangLink
                    href={`/bql/can-ho${queryLoc(loc, { trang: String(trang + 1) })}`}
                    tat={trang >= soTrang}
                  >
                    Sau
                  </TrangLink>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <p className="text-[0.75rem] leading-relaxed text-faint">
        Đổi diện tích ở đây <strong>không tính lại hóa đơn đã phát</strong>: hóa đơn giữ số
        tiền đã chốt lúc tạo. Diện tích mới áp cho kỳ phát sau.
      </p>
    </div>
  )
}

function TrangLink({ href, tat, children }: { href: string; tat: boolean; children: string }) {
  const lop = 'inline-flex h-8 items-center rounded-ctl border px-2.5 text-[0.8125rem] font-medium'
  return tat
    ? <span className={`${lop} border-line text-faint`}>{children}</span>
    : <Link href={href} className={`${lop} border-line-firm text-ink hover:bg-sunken`}>{children}</Link>
}
