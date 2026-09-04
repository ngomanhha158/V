import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong, ngayGioVN } from '@/components/ui'
import { NHAN_TRANG_THAI, TONE_TRANG_THAI, m2, phanTram, trangThaiBQ } from '@/lib/bieu-quyet'
import type { CuocBQ } from '@/components/ket-qua-bq'
import { FormMo } from './form'

/**
 * Biểu quyết hội nghị nhà chung cư.
 *
 * Đây là màn dùng một hai lần mỗi năm nhưng đúng vào lúc cả tòa nhà đang nhìn.
 * Kiểm phiếu giấy cho 468 căn mất cả ngày và luôn có người nghi ngờ — chỗ này
 * làm việc đó trong một giây và để lại đủ dấu vết cho người nghi ngờ tự tra.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Biểu quyết hội nghị" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const [{ data: ds, error }, { data: canThieu }] = await Promise.all([
    db.from('bieu_quyet').select('*').eq('project_id', project.id).order('mo_luc', { ascending: false }),
    db.from('units').select('id, code, area_m2, buildings!inner(project_id)')
      .eq('buildings.project_id', project.id).or('area_m2.is.null,area_m2.lte.0'),
  ])

  const rows = (ds ?? []) as CuocBQ[]
  const thieu = canThieu ?? []

  return (
    <div className="space-y-5">
      <PageHead
        title="Biểu quyết hội nghị"
        sub="Phiếu tính theo DIỆN TÍCH — khác hẳn thăm dò ở bảng tin, nơi mỗi căn một lá"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần biểu quyết chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {/* Cảnh báo TRƯỚC khi người ta soạn xong nội dung rồi mới bị chặn. Câu
          chặn ở database là đúng, nhưng gặp nó sau khi đã gõ xong một nghị
          quyết dài thì bực. */}
      {thieu.length > 0 && (
        <Hop tone="canh" title={`${thieu.length} căn chưa có diện tích — chưa mở được cuộc nào`}>
          Diện tích là TRỌNG SỐ của lá phiếu, nên thiếu một căn là mẫu số sai và
          mọi tỷ lệ tính ra đều cãi được. Nhập nốt ở{' '}
          <Link href="/bql/can-ho" className="font-medium underline">Căn hộ &amp; diện tích</Link>
          {' '}rồi quay lại. Đang thiếu:{' '}
          <span className="num">
            {thieu.slice(0, 12).map((u) => u.code).join(', ')}
            {thieu.length > 12 && `… và ${thieu.length - 12} căn nữa`}
          </span>
        </Hop>
      )}

      <Card>
        <CardHead title="Các cuộc đã mở" sub={`${rows.length} cuộc`} />
        {rows.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có cuộc biểu quyết nào">
              Mở cuộc đầu tiên ở khối bên dưới. Nội dung, hai ngưỡng và danh sách
              căn được đóng băng ngay lúc mở.
            </Trong>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((b) => {
              const t = trangThaiBQ(b)
              return (
                <Link
                  key={b.id}
                  href={`/bql/bieu-quyet/${b.id}`}
                  className="block px-4 py-3 transition-colors hover:bg-sunken"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium break-words text-ink">{b.tieu_de}</div>
                      <div className="num mt-0.5 text-[0.75rem] text-faint">
                        Mở {ngayGioVN(b.mo_luc)} · {b.so_can} căn · {m2(b.tong_dien_tich)}
                      </div>
                      <div className="mt-0.5 text-[0.75rem] text-muted">
                        Cần {phanTram(b.nguong_du_hop)} dự họp, {phanTram(b.nguong_thong_qua)} tán thành
                        {t === 'da_dong' && b.kq_thong_qua != null && (
                          <> · kết quả: {b.kq_thong_qua ? 'thông qua' : b.kq_du_hop ? 'không thông qua' : 'chưa đủ dự họp'}</>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0">
                      <Pill tone={TONE_TRANG_THAI[t]}>{NHAN_TRANG_THAI[t]}</Pill>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title="Mở cuộc mới"
          sub="Chỉ trưởng BQL hoặc thành viên BQT"
        />
        <div className="p-4"><FormMo project={project.id} /></div>
      </Card>

      <Hop tone="trung" title="Hai ngưỡng, hai mẫu số — đừng gộp">
        <span className="block">
          <b>Dự họp</b> tính trên diện tích TOÀN KHU: bao nhiêu phần trăm diện tích
          đã bỏ phiếu. Chưa đạt thì hội nghị chưa đủ điều kiện tiến hành, và tỷ lệ
          tán thành lúc đó chưa nói lên điều gì.
        </span>
        <span className="mt-2 block">
          <b>Thông qua</b> tính trên diện tích ĐÃ BỎ PHIẾU: trong số đã bỏ, bao nhiêu
          phần trăm tán thành. Lấy nhầm mẫu số toàn khu ở đây là cách kinh điển để
          đánh trượt oan một nghị quyết đã đủ phiếu.
        </span>
      </Hop>
    </div>
  )
}
