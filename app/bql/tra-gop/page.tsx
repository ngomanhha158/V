import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import {
  Card, CardHead, Hop, PageHead, Pill, Trong, ngayVN, vnd,
} from '@/components/ui'
import { NHAN_CACH_CHIA, kyVN } from '@/lib/tra-gop'
import { FormLap, NutDung } from './form'

/**
 * Thu theo đợt cho khoản lớn.
 *
 * Màn này dùng vài lần trong đời một tòa nhà, và mỗi lần là lúc cả khu đang bàn
 * tán về một khoản tiền lớn.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const project = await duAnBQL()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Thu theo đợt" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const [{ data: ds, error }, { count: soCan }] = await Promise.all([
    db.rpc('ke_hoach_thu_ds', { p_project: project.id }),
    db.from('units').select('id, buildings!inner(project_id)', { count: 'exact', head: true })
      .eq('buildings.project_id', project.id),
  ])
  const rows = ds ?? []

  return (
    <div className="space-y-5">
      <PageHead
        title="Thu theo đợt"
        sub="Khoản lớn chia thành nhiều tháng — mỗi đợt là một DÒNG trên hóa đơn tháng, không phải một loại tiền khác"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần thu theo đợt chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {rows.map((k) => {
        const daDung = !!k.huy_luc
        return (
          <Card key={k.id}>
            <CardHead
              xuongDong
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words">{k.ten}</span>
                  {daDung && <Pill tone="trung">Đã dừng thu</Pill>}
                </span>
              }
              sub={
                `${NHAN_CACH_CHIA[k.cach_chia] ?? k.cach_chia} · ${k.so_can} căn · `
                + `${k.so_dot} đợt từ kỳ ${kyVN(k.ky_bat_dau)} · ${k.nghi_quyet}`
                + (k.ngay_nq ? ` ngày ${ngayVN(k.ngay_nq)}` : '')
              }
            />
            <div className="space-y-4 p-4">
              {daDung && (
                <Hop tone="trung" title="Kế hoạch này đã dừng">
                  Lý do: {k.ly_do_huy?.trim() || 'không ghi'}. Các đợt đã nằm trên hóa
                  đơn đã phát hành vẫn giữ nguyên.
                </Hop>
              )}

              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
                  <dt className="text-[0.75rem] font-medium text-muted">Tổng chi phí</dt>
                  <dd className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                    {vnd(k.tong_chi_phi)}
                  </dd>
                </div>
                <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
                  <dt className="text-[0.75rem] font-medium text-muted">Đã lên hóa đơn phát hành</dt>
                  <dd className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                    {vnd(k.da_len_hoa_don)}
                  </dd>
                  <dd className="num mt-1.5 text-[0.75rem] text-faint">
                    {k.dot_da_qua}/{k.so_dot} đợt đã tới kỳ
                  </dd>
                </div>
                <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
                  <dt className="text-[0.75rem] font-medium text-muted">Chưa tới kỳ</dt>
                  <dd className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                    {vnd(k.chua_toi_ky)}
                  </dd>
                </div>
              </dl>

              {/* CỐ Ý không có ô "đã thu". Xem ghi chú ở lib/tra-gop.ts. */}
              <Hop tone={k.so_can_con_no > 0 ? 'canh' : 'trung'}>
                {k.so_can_con_no > 0
                  ? `${k.so_can_con_no} căn còn nợ hóa đơn có chứa đợt thu này. `
                  : 'Chưa căn nào nợ hóa đơn có chứa đợt thu này. '}
                Màn này không có ô &ldquo;đã thu bao nhiêu&rdquo;, và đó là cố ý: đợt thu
                nằm chung một tờ hóa đơn với phí quản lý và tiền nước, nên khi cư dân
                chuyển thiếu thì không có cách nào biết phần thiếu thuộc dòng nào.
                Mọi cách chia đều là bịa.
              </Hop>

              <div className="flex flex-wrap items-start gap-3 border-t border-line pt-4">
                <Link
                  href={`/bql/tra-gop/${k.id}`}
                  className="inline-flex h-8 items-center rounded-ctl border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-sunken"
                >
                  Xem từng căn
                </Link>
                {!daDung && <NutDung id={k.id} />}
              </div>
            </div>
          </Card>
        )
      })}

      {!error && rows.length === 0 && (
        <Trong title="Chưa có kế hoạch thu nào">
          Lập cái đầu tiên ở khối bên dưới — thường là lúc có khoản chi lớn đầu
          tiên phải phân bổ, sơn lại mặt ngoài hoặc thay thang máy.
        </Trong>
      )}

      <Card>
        <CardHead title="Lập kế hoạch thu mới" sub="Chỉ trưởng BQL hoặc thành viên BQT" />
        <div className="p-4"><FormLap project={project.id} soCan={soCan ?? 0} /></div>
      </Card>

      <Hop tone="trung" title="Vì sao chia đợt chứ không cho nợ rồi trả dần">
        <span className="block">
          Giữ một hóa đơn lớn rồi cho trả dần thì hạn nộp chỉ có MỘT. Hộ đang trả
          đúng lịch vẫn bị đếm là quá hạn ngay từ ngày đầu, và mọi màn công nợ sẽ
          tô đỏ đúng những người đang làm đúng.
        </span>
        <span className="mt-2 block">
          Chia đợt thì mỗi đợt là một dòng trên hóa đơn của kỳ nó thuộc về, với
          hạn nộp của kỳ đó. Cư dân vẫn chuyển một lần mỗi tháng, mã QR không đổi,
          và công nợ nói đúng sự thật.
        </span>
      </Hop>
    </div>
  )
}
