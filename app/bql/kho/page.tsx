import { createClient } from '@/lib/db/server'
import {
  Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, Trong, cx, ngayGioVN, vnd,
} from '@/components/ui'
import { NHAN_LOAI, TONE_LOAI, dauPhieu, loiTon, soVN, type Ton } from '@/lib/kho'
import { FormKiemKe, FormNhap, FormXuat } from './form'

/**
 * Kho vật tư.
 *
 * Màn này trả lời đúng một câu mà cuối tháng ban quản trị hỏi: "hết chừng này
 * tiền vật tư, dùng cho căn nào".
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Kho vật tư" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const homNay = new Date().toISOString().slice(0, 10)
  const truoc30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const [{ data: tonRaw, error }, { data: so }, { data: yc }] = await Promise.all([
    db.rpc('ton_kho', { p_project: project.id }),
    db.rpc('so_kho', { p_project: project.id, p_tu: truoc30, p_den: homNay }),
    db.from('tickets')
      .select('id, title, units!inner(code)')
      .eq('project_id', project.id)
      .not('status', 'in', '("resolved","closed","rejected")')
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const ton = (tonRaw ?? []) as Ton[]
  const sapHet = ton.filter((t) => t.sap_het)
  const tongGiaTri = ton.reduce((s, t) => s + t.gia_tri, 0)
  const yeuCau = (yc ?? []).map((t) => ({
    id: t.id, title: t.title,
    ma_can: (t as unknown as { units: { code: string } }).units?.code ?? '—',
  }))

  return (
    <div className="space-y-5">
      <PageHead
        title="Kho vật tư"
        sub="Tồn là TỔNG của sổ, không phải một con số ai cũng sửa được — và mỗi lần xuất đều gắn với một yêu cầu"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được tồn kho">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần kho vật tư chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {sapHet.length > 0 && (
        <Hop tone="canh" title={`${sapHet.length} vật tư sắp hết hoặc đã hết`}>
          {sapHet.slice(0, 6).map((t) => (
            <span key={t.id} className="block">{t.ten}: {loiTon(t).loi}</span>
          ))}
          {sapHet.length > 6 && <span className="block">… và {sapHet.length - 6} vật tư nữa.</span>}
        </Hop>
      )}

      <Card>
        <CardHead
          title="Tồn kho"
          sub={`${ton.length} vật tư · giá trị ${vnd(tongGiaTri)}`}
        />
        {ton.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa khai báo vật tư nào">
              Thêm vật tư vào bảng <span className="num">vat_tu</span> (mã, tên, đơn vị,
              mức tồn tối thiểu), rồi nhập lô đầu tiên ở khối bên dưới.
            </Trong>
          </div>
        ) : (
          <div className="scroll-x max-h-[28rem] overflow-auto">
            <Bang>
              <thead>
                <Tr>
                  <Th>Vật tư</Th>
                  <Th className="text-right">Tồn</Th>
                  <Th className="hidden text-right sm:table-cell">Tối thiểu</Th>
                  <Th className="text-right">Đơn giá</Th>
                  <Th className="hidden text-right sm:table-cell">Giá trị</Th>
                </Tr>
              </thead>
              <tbody>
                {ton.map((t) => (
                  <Tr key={t.id}>
                    <Td>
                      <span className="font-medium text-ink">{t.ten}</span>
                      <span className="num text-faint"> · {t.ma}</span>
                    </Td>
                    <Td className={cx('num text-right whitespace-nowrap', t.sap_het && 'font-semibold text-bad')}>
                      {soVN(t.ton)} {t.don_vi}
                    </Td>
                    <Td className="num hidden text-right whitespace-nowrap text-muted sm:table-cell">
                      {soVN(t.ton_toi_thieu)}
                    </Td>
                    <Td className="num text-right whitespace-nowrap">{vnd(t.don_gia)}</Td>
                    <Td className="num hidden text-right whitespace-nowrap text-muted sm:table-cell">
                      {vnd(t.gia_tri)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Bang>
          </div>
        )}
        <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
          Không có ô nào để gõ tồn kho vào, và đó là cố ý: tồn là tổng của sổ. Sửa
          thì đi qua kiểm kê — có lý do, có tên người, có dòng chênh lệch nằm lại.
          Đơn giá là bình quân gia quyền, tính lại sau mỗi lần nhập.
        </p>
      </Card>

      {ton.length > 0 && (
        <>
          <Card>
            <CardHead title="Xuất kho" sub="Gắn vào yêu cầu để cuối tháng tra ngược được" />
            <div className="p-4">
              <FormXuat project={project.id} ton={ton} yeuCau={yeuCau} />
            </div>
          </Card>

          <Card>
            <CardHead title="Nhập kho" sub="Giá kho tính lại theo bình quân gia quyền" />
            <div className="p-4"><FormNhap project={project.id} ton={ton} /></div>
          </Card>

          <Card>
            <CardHead title="Kiểm kê" sub="Chỉ trưởng BQL — đây là bước sửa lại sổ sách" />
            <div className="p-4"><FormKiemKe project={project.id} ton={ton} /></div>
          </Card>
        </>
      )}

      <Card>
        <CardHead title="Sổ kho 30 ngày" sub={`${(so ?? []).length} phiếu`} />
        {(so ?? []).length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có phiếu nào trong 30 ngày">
              Mỗi lần nhập, xuất hay kiểm kê là một phiếu. Sổ trống nghĩa là vật tư
              đang đi ra đi vào mà không ai ghi.
            </Trong>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {(so ?? []).map((p) => (
              <div key={p.phieu_id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={TONE_LOAI[p.loai as keyof typeof TONE_LOAI] ?? 'trung'}>
                        {NHAN_LOAI[p.loai as keyof typeof NHAN_LOAI] ?? p.loai}
                      </Pill>
                      <span className="num text-[0.8125rem] font-medium text-ink">
                        {dauPhieu(p.loai)}{vnd(p.tong_tien)}
                      </span>
                      <span className="text-[0.75rem] text-faint">{p.so_dong} dòng</span>
                    </div>
                    <div className="num mt-0.5 text-[0.75rem] text-faint">
                      {ngayGioVN(p.luc)}{p.nguoi && ` · ${p.nguoi}`}
                    </div>
                    <div className="mt-0.5 text-[0.8125rem] text-muted">
                      {p.tieu_de_yc
                        ? <>Cho yêu cầu <span className="num">{p.ma_can}</span> — {p.tieu_de_yc}</>
                        : (p.ly_do || 'Không ghi lý do')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Hop tone="trung" title="Vì sao tồn kho không phải một cột">
        Cách hiển nhiên là để một cột <span className="num">ton</span> rồi trừ đi mỗi
        lần xuất. Làm thế thì không bao giờ giải thích được con số đó từ đâu ra, và
        hai người xuất cùng lúc là mất một lần trừ. Ở đây tồn là tổng các dòng giao
        dịch — mỗi con số trên màn này đều lần ngược về được một phiếu, một người và
        một thời điểm.
      </Hop>
    </div>
  )
}
