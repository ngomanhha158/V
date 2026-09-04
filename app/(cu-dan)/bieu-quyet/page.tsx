import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong, ngayGioVN } from '@/components/ui'
import { NHAN_TRANG_THAI, TONE_TRANG_THAI, m2, phanTram, trangThaiBQ, tyLe } from '@/lib/bieu-quyet'
import type { CuocBQ } from '@/components/ket-qua-bq'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: ds, error } = await db
    .from('bieu_quyet').select('*').order('mo_luc', { ascending: false }).limit(50)
  const rows = (ds ?? []) as CuocBQ[]
  const dangMo = rows.filter((b) => trangThaiBQ(b) === 'dang_mo')

  return (
    <div className="space-y-5">
      <PageHead
        title="Biểu quyết hội nghị"
        sub="Phiếu tính theo diện tích căn hộ, và chỉ chủ sở hữu bỏ được"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần biểu quyết chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {dangMo.length > 0 && (
        <Hop tone="canh" title={`${dangMo.length} cuộc đang mở`}>
          Mở từng cuộc để xem nội dung và bỏ phiếu. Chưa bỏ mà cuộc đóng thì căn
          của bạn không nằm trong mẫu số — mà mẫu số chính là thứ quyết định hội
          nghị có đủ điều kiện tiến hành hay không.
        </Hop>
      )}

      {rows.length === 0 && !error ? (
        <Trong title="Chưa có cuộc biểu quyết nào">
          Khi ban quản trị mở một cuộc, nó hiện ở đây và bạn có thông báo.
        </Trong>
      ) : (
        <Card>
          <CardHead title="Tất cả các cuộc" sub={`${rows.length} cuộc`} />
          <div className="divide-y divide-line">
            {rows.map((b) => {
              const t = trangThaiBQ(b)
              return (
                <Link
                  key={b.id}
                  href={`/bieu-quyet/${b.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-sunken"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium break-words text-ink">{b.tieu_de}</div>
                      <div className="num mt-0.5 text-[0.75rem] text-faint">
                        {t === 'da_dong'
                          ? `Kiểm phiếu ${ngayGioVN(b.dong_luc!)}`
                          : `Mở ${ngayGioVN(b.mo_luc)}`}
                        {' · '}{b.so_can} căn · {m2(b.tong_dien_tich)}
                      </div>
                      {t === 'da_dong' && (
                        <div className="mt-0.5 text-[0.75rem] text-muted">
                          {b.kq_thong_qua
                            ? `Thông qua với ${phanTram(
                                tyLe(b.kq_tan_thanh ?? 0, b.kq_dien_tich_bo_phieu ?? 0),
                              )} tán thành`
                            : b.kq_du_hop
                              ? 'Không thông qua'
                              : 'Không đủ điều kiện tiến hành'}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0">
                      <Pill tone={TONE_TRANG_THAI[t]}>{NHAN_TRANG_THAI[t]}</Pill>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>
      )}

      <Hop tone="trung" title="Khác gì với thăm dò ở bảng tin">
        Thăm dò ở bảng tin là hỏi ý — mỗi căn một lá, không phân biệt căn to căn
        nhỏ. Biểu quyết hội nghị thì theo luật: lá phiếu nặng theo diện tích căn
        hộ, và chỉ chủ sở hữu hoặc người được ủy quyền mới bỏ được. Kết quả ở đây
        là cơ sở của nghị quyết hội nghị nhà chung cư, nên nó chặt hơn hẳn.
      </Hop>
    </div>
  )
}
