import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import {
  Bang, Card, CardHead, Chip, Hop, PageHead, Pill, Stat, Td, Th, Tr, Trong,
  cx, ngayVN, vnd, vndGon,
} from '@/components/ui'
import { IcDienThoai } from '@/components/icons'

export const dynamic = 'force-dynamic'

const NHOM = [
  { key: 'chua_han', nhan: 'Chưa tới hạn', hop: (d: number) => d < 0 },
  { key: 'd0_30', nhan: '≤ 30 ngày', hop: (d: number) => d >= 0 && d <= 30 },
  { key: 'd31_90', nhan: '31–90 ngày', hop: (d: number) => d > 30 && d <= 90 },
  { key: 'd90', nhan: '> 90 ngày', hop: (d: number) => d > 90 },
] as const

/** Nợ càng già càng khó đòi — bảng phải nói được điều đó chỉ bằng một cái liếc. */
function tuoiNo(d: number) {
  if (d < 0) return { nhan: `còn ${-d} ngày`, tone: 'trung' as const }
  if (d === 0) return { nhan: 'đến hạn hôm nay', tone: 'canh' as const }
  if (d <= 30) return { nhan: `quá ${d} ngày`, tone: 'canh' as const }
  return { nhan: `quá ${d} ngày`, tone: 'xau' as const }
}

export default async function CongNo({
  searchParams,
}: { searchParams: Promise<{ nhom?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const { data: rows, error } = await supabase.rpc('bql_debt_report', { p_project: project.id })

  // Không nuốt lỗi: bảng trống vì lỗi truy vấn trông y hệt bảng trống vì hết nợ,
  // mà hai chuyện đó ngược hẳn nhau.
  if (error) {
    return (
      <div className="space-y-5">
        <PageHead title="Công nợ" />
        <Hop tone="xau" title="Không tải được báo cáo">{error.message}</Hop>
      </div>
    )
  }

  const all = rows ?? []
  const chon = NHOM.find((n) => n.key === sp.nhom)
  const hien = chon ? all.filter((r) => chon.hop(r.so_ngay_qua_han)) : all

  const tong = all.reduce((s, r) => s + r.con_no, 0)
  const quaHan = all.filter((r) => r.so_ngay_qua_han >= 0)
  const tienQuaHan = quaHan.reduce((s, r) => s + r.con_no, 0)
  const nang = all.filter((r) => r.so_ngay_qua_han > 90)
  const khongChuHo = all.filter((r) => !r.ten_lien_he)

  return (
    <div className="space-y-5">
      <PageHead title="Công nợ" sub={`${project.name} · gộp theo căn, xếp theo số tiền còn thiếu`} />

      {all.length === 0 ? (
        <Trong title="Không có công nợ nào">
          Mọi hóa đơn đã phát hành đều đã thu đủ. Không có gì phải đòi.
        </Trong>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat nhan="Tổng phải thu" so={vnd(tong)} phu={`${all.length} căn còn nợ`} />
            <Stat
              nhan="Đã quá hạn" so={vnd(tienQuaHan)}
              phu={`${quaHan.length} căn · ${Math.round((tienQuaHan / tong) * 100)}% tổng nợ`}
              tone={tienQuaHan > 0 ? 'xau' : 'tot'}
            />
            <Stat
              nhan="Nợ trên 90 ngày" so={nang.length}
              phu={nang.length
                ? `${vndGon(nang.reduce((s, r) => s + r.con_no, 0))} — cần đưa ban quản trị`
                : 'Không có'}
              tone={nang.length ? 'xau' : 'tot'}
            />
            <Stat
              nhan="Chưa có chủ hộ" so={khongChuHo.length}
              phu={khongChuHo.length ? 'Không có ai để liên hệ đòi' : 'Đủ người liên hệ'}
              tone={khongChuHo.length ? 'canh' : 'trung'}
            />
          </div>

          <Card>
            <CardHead
              title="Danh sách căn còn nợ"
              right={
                <div className="flex flex-wrap gap-1.5">
                  <Chip href="/bql/cong-no" active={!chon}>Tất cả ({all.length})</Chip>
                  {NHOM.map((n) => (
                    <Chip key={n.key} href={`/bql/cong-no?nhom=${n.key}`} active={chon?.key === n.key}>
                      {n.nhan} ({all.filter((r) => n.hop(r.so_ngay_qua_han)).length})
                    </Chip>
                  ))}
                </div>
              }
            />

            {!hien.length ? (
              <div className="p-4"><Trong title="Không có căn nào trong nhóm này" /></div>
            ) : (
              <Bang>
                <thead>
                  <tr>
                    <Th>Căn hộ</Th><Th>Người liên hệ</Th><Th phai>Số HĐ</Th>
                    <Th phai>Còn nợ</Th><Th phai>Hạn cũ nhất</Th><Th phai>Tuổi nợ</Th>
                  </tr>
                </thead>
                <tbody>
                  {hien.map((r) => {
                    const t = tuoiNo(r.so_ngay_qua_han)
                    return (
                      <Tr key={r.unit_id}>
                        <Td>
                          <div className="font-semibold text-ink">{r.unit_code}</div>
                          <div className="text-[0.75rem] text-faint">Tòa {r.building_code}</div>
                        </Td>
                        <Td>
                          {r.ten_lien_he ? (
                            <>
                              <div className="text-ink">{r.ten_lien_he}</div>
                              {r.dien_thoai && (
                                <a
                                  href={`tel:${r.dien_thoai}`}
                                  className="num mt-0.5 inline-flex items-center gap-1 text-[0.8125rem] text-brand hover:underline"
                                >
                                  <IcDienThoai width={13} height={13} /> {r.dien_thoai}
                                </a>
                              )}
                            </>
                          ) : (
                            <Pill tone="canh">Chưa có chủ hộ</Pill>
                          )}
                        </Td>
                        <Td phai so className="text-muted">{r.so_hoa_don}</Td>
                        <Td phai so>
                          <span className={cx('font-semibold', r.so_ngay_qua_han > 90 ? 'text-bad' : 'text-ink')}>
                            {vnd(r.con_no)}
                          </span>
                        </Td>
                        <Td phai so className="text-muted">{ngayVN(String(r.han_cu_nhat))}</Td>
                        <Td phai><Pill tone={t.tone}>{t.nhan}</Pill></Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Bang>
            )}
          </Card>
        </>
      )}

      <Hop tone="brand" title="Nhắc nợ tự động">
        Cron chạy 08:00 hằng ngày, bắn thông báo ở ba mốc: trước hạn 3 ngày,
        đúng ngày đến hạn, và quá hạn 3 ngày. Chỉ người được xem công nợ mới
        nhận — con cái trong nhà không nhận tin đòi tiền. Hàm tự chống nhắc
        trùng trong 20 giờ nên chạy lại không bắn hai lần.
      </Hop>
    </div>
  )
}
