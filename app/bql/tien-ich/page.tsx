import { createClient } from '@/lib/db/server'
import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, Trong, ngayVN, vnd } from '@/components/ui'
import { LichSuat, type ONgay } from '@/components/lich-suat'
import { nhanSuat, type OSuat } from '@/lib/tien-ich'
import { FormDong, FormSuat, FormTienIch } from './form'

export const dynamic = 'force-dynamic'

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ti?: string }>
}) {
  const sp = await searchParams
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Tiện ích" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const { data: ds, error } = await db
    .from('tien_ich')
    .select('id, ten, mo_ta, dia_diem, phi, toi_da_tuan, dat_truoc_ngay, dang_mo')
    .eq('project_id', project.id)
    .order('ten')

  const chon = (ds ?? []).find((t) => t.id === sp.ti) ?? (ds ?? [])[0]
  const { data: suatDs } = chon
    ? await db.from('tien_ich_suat').select('id, thu_tu, bat_dau, ket_thuc')
        .eq('tien_ich_id', chon.id).order('thu_tu')
    : { data: [] }

  const homNay = new Date()
  const tu = iso(homNay)
  const den = iso(new Date(homNay.getTime() + 13 * 86_400_000))
  const { data: lich } = chon
    ? await db.rpc('lich_tien_ich', { p_tien_ich: chon.id, p_tu: tu, p_den: den })
    : { data: [] }

  const theoNgay = new Map<string, OSuat[]>()
  for (const r of lich ?? []) {
    const arr = theoNgay.get(r.ngay) ?? []
    arr.push(r as OSuat)
    theoNgay.set(r.ngay, arr)
  }
  const ngayDs: ONgay[] = [...theoNgay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ngay, o]) => ({ ngay, o }))

  const daDat = (lich ?? []).filter((r) => !r.con_trong)

  return (
    <div className="space-y-5">
      <PageHead
        title="Tiện ích"
        sub="Khai báo khung giờ, xem ai giữ chỗ, đóng suất khi bảo trì"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách tiện ích">
          {error.code === '42P01'
            ? 'Phần tiện ích chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {(ds ?? []).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {(ds ?? []).map((t) => (
            <a
              key={t.id}
              href={`/bql/tien-ich?ti=${t.id}`}
              className={
                t.id === chon?.id
                  ? 'rounded-lg border border-brand-line bg-brand-soft px-3 py-1.5 text-[0.8125rem] font-medium text-brand'
                  : 'rounded-lg border border-line-firm px-3 py-1.5 text-[0.8125rem] font-medium text-muted hover:bg-sunken'
              }
            >
              {t.ten}
            </a>
          ))}
        </div>
      )}

      {chon && (suatDs ?? []).length === 0 && (
        <Hop tone="canh" title={`"${chon.ten}" chưa có khung giờ nào`}>
          Cư dân chưa đặt được gì cả — lịch của họ hiện ra trống trơn và không có
          gì giải thích vì sao. Thêm ít nhất một khung giờ ở dưới.
        </Hop>
      )}

      {chon && (suatDs ?? []).length > 0 && (
        <Card>
          <CardHead title={`Lịch 14 ngày · ${chon.ten}`} />
          <div className="p-4">
            <LichSuat ngayDs={ngayDs} base="#" phi={chon.phi} />
          </div>
        </Card>
      )}

      <Card>
        <CardHead title={chon ? `Sửa "${chon.ten}"` : 'Tạo tiện ích đầu tiên'} />
        <div className="p-4"><FormTienIch project={project.id} ti={chon} /></div>
      </Card>

      {chon && (
        <>
          <Card>
            <CardHead title="Khung giờ" sub={`${(suatDs ?? []).length} suất mỗi ngày`} />
            {(suatDs ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-3">
                {(suatDs ?? []).map((s) => (
                  <Pill key={s.id} tone="trung">
                    {s.thu_tu}. {nhanSuat(s.bat_dau, s.ket_thuc)}
                  </Pill>
                ))}
              </div>
            )}
            <div className="p-4">
              <FormSuat
                tienIch={chon.id}
                thuTuKe={Math.max(0, ...(suatDs ?? []).map((s) => s.thu_tu)) + 1}
              />
            </div>
          </Card>

          {(suatDs ?? []).length > 0 && (
            <Card>
              <CardHead
                title="Đóng một suất"
                sub="Bảo trì, vệ sinh — cư dân thấy lý do bạn ghi"
              />
              <div className="p-4">
                <FormDong
                  suatDs={(suatDs ?? []).map((s) => ({
                    id: s.id, nhan: `${s.thu_tu}. ${nhanSuat(s.bat_dau, s.ket_thuc)}`,
                  }))}
                />
              </div>
            </Card>
          )}

          <Card>
            <CardHead title="Ai đang giữ chỗ" sub={`${daDat.length} suất trong 14 ngày tới`} />
            {daDat.length === 0 ? (
              <div className="p-4">
                <Trong title="Chưa ai đặt">
                  Bình thường trong tuần đầu. Nếu kéo dài, kiểm lại xem cư dân có
                  nhìn thấy tiện ích này không — nó phải đang mở.
                </Trong>
              </div>
            ) : (
              <div className="scroll-x overflow-x-auto">
                <Bang>
                  <thead>
                    <Tr>
                      <Th>Ngày</Th>
                      <Th>Khung giờ</Th>
                      <Th>Căn</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {daDat.map((r) => (
                      <Tr key={`${r.suat_id}|${r.ngay}`}>
                        <Td className="num whitespace-nowrap">{ngayVN(r.ngay)}</Td>
                        <Td className="num whitespace-nowrap">{nhanSuat(r.bat_dau, r.ket_thuc)}</Td>
                        <Td>
                          {r.dong_cua ? (
                            <span className="text-muted">Đóng — {r.ly_do}</span>
                          ) : (
                            <span className="num font-medium">{r.ma_can ?? '—'}</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Bang>
              </div>
            )}
          </Card>
        </>
      )}

      {chon && chon.phi > 0 && (
        <Hop tone="canh" title="Phí tiện ích chưa tự vào hóa đơn">
          Hệ thống ghi {vnd(chon.phi)} vào từng lượt đặt và giữ nguyên con số đó
          kể cả khi bảng giá đổi, nhưng <strong>chưa tự cộng vào hóa đơn tháng</strong>.
          Hiện phải tự thêm dòng khi phát hành. Nối vào <code>generate_invoices</code>
          là một việc riêng, làm sau.
        </Hop>
      )}
    </div>
  )
}
