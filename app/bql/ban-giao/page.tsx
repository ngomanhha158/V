import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Bang, Card, CardHead, Hop, PageHead, Td, Th, Tr, Trong, ngayVN, vnd } from '@/components/ui'
import { ChotSo, type BanChot } from '@/components/chot-so'
import { trangThaiChot } from '@/lib/ban-giao'
import { FormLap, NutHuy, NutKy } from './form'

/**
 * Chốt sổ bàn giao. Đây là màn dùng vài lần trong đời một tòa nhà — nhưng đúng
 * vào những lần đó thì nó là thứ đắt nhất trong cả hệ thống.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Chốt sổ bàn giao" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const homQua = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const [{ data: ds, error }, { data: xemTruoc }] = await Promise.all([
    db.rpc('chot_ban_giao_ds', { p_project: project.id }),
    db.rpc('cong_no_toi_moc', { p_project: project.id, p_moc: homQua }),
  ])

  const rows = (ds ?? []) as BanChot[]
  const truoc = xemTruoc ?? []
  const tongTruoc = truoc.reduce((t, r) => t + r.phai_thu, 0)

  return (
    <div className="space-y-5">
      <PageHead
        title="Chốt sổ bàn giao"
        sub="Đổi đơn vị quản lý là lúc dễ mất tiền nhất — bản chốt là tờ giấy ở giữa hai bên"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách bản chốt">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần chốt sổ bàn giao chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {rows.map((c) => {
        const t = trangThaiChot(c)
        return (
          <ChotSo
            key={c.id}
            c={c}
            hanhDong={
              t === 'da_huy' ? null : (
                <div className="flex flex-wrap items-start gap-3">
                  {t !== 'da_ky' && <NutKy id={c.id} />}
                  {t !== 'da_ky' && <NutHuy id={c.id} />}
                  {t === 'da_ky' && (
                    <p className="text-[0.8125rem] leading-relaxed text-muted">
                      Đã đủ hai chữ ký nên không sửa và không hủy được nữa. Cần đổi
                      thì lập bản chốt mới cho một mốc khác — bản này ở lại làm
                      bằng chứng của thời điểm đó.
                    </p>
                  )}
                </div>
              )
            }
          />
        )
      })}

      {!error && rows.length === 0 && (
        <Trong title="Chưa có bản chốt nào">
          Lập bản đầu tiên ở khối bên dưới. Không nhất thiết phải đang đổi đơn vị
          quản lý — chốt sổ định kỳ cũng là cách để về sau không ai phải nhớ lại.
        </Trong>
      )}

      <Card>
        <CardHead
          title="Xem trước: công nợ tính tới hôm qua"
          sub={`${truoc.length} căn · ${vnd(tongTruoc)}`}
        />
        {truoc.length === 0 ? (
          <p className="p-4 text-[0.8125rem] text-muted">
            Chưa có căn nào có công nợ tính tới {ngayVN(homQua)}.
          </p>
        ) : (
          <div className="scroll-x max-h-80 overflow-auto">
            <Bang>
              <thead>
                <Tr>
                  <Th>Căn</Th>
                  <Th className="text-right">Phải thu</Th>
                  <Th className="hidden text-right sm:table-cell">Quá 90 ngày</Th>
                  <Th className="hidden sm:table-cell">Hóa đơn cũ nhất</Th>
                </Tr>
              </thead>
              <tbody>
                {truoc.slice(0, 100).map((r) => (
                  <Tr key={r.unit_id}>
                    <Td className="num font-medium whitespace-nowrap">{r.ma_can}</Td>
                    <Td className="num text-right whitespace-nowrap">{vnd(r.phai_thu)}</Td>
                    <Td className="num hidden text-right whitespace-nowrap text-bad sm:table-cell">
                      {r.qua_han_90 > 0 ? vnd(r.qua_han_90) : '—'}
                    </Td>
                    <Td className="num hidden whitespace-nowrap text-muted sm:table-cell">
                      {r.hoa_don_cu_nhat ? ngayVN(r.hoa_don_cu_nhat) : '—'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Bang>
          </div>
        )}
        <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
          Đây là truy vấn SỐNG, đổi theo từng khoản tiền về. Bấm chốt thì con số
          được đóng băng và không đổi nữa — đó là cả điểm khác nhau giữa hai khối
          trên màn này.
        </p>
      </Card>

      <Card>
        <CardHead title="Chốt một mốc mới" sub="Chỉ trưởng BQL hoặc thành viên BQT" />
        <div className="p-4"><FormLap project={project.id} /></div>
      </Card>

      <Hop tone="trung" title="Vì sao phải hai bên ký">
        Một người ký cả hai ô thì &ldquo;hai bên ký&rdquo; chỉ còn là một người
        tự xác nhận với chính mình — hệ thống chặn ngay ở tầng database. Bên nào
        ký cũng không tự chọn được: suy ra từ vai trò của tài khoản đang đăng
        nhập. Cư dân đọc được bản chốt ở{' '}
        <Link href="/ban-giao" className="font-medium text-brand hover:underline">
          màn công khai
        </Link>
        , nhưng chỉ thấy dòng công nợ của căn mình.
      </Hop>
    </div>
  )
}
