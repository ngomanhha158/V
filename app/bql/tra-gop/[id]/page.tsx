import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import {
  Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, cx, ngayVN, vnd,
} from '@/components/ui'
import { NHAN_CACH_CHIA, NHAN_DOT, TONE_DOT, kyVN, trangThaiDot } from '@/lib/tra-gop'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const { data: kh, error } = await db.from('ke_hoach_thu').select('*').eq('id', id).maybeSingle()
  if (error?.code === '42P01' || error?.code === '42883') {
    return (
      <div className="space-y-5">
        <PageHead title="Thu theo đợt" />
        <Hop tone="xau" title="Phần thu theo đợt chưa có trên database">
          Chạy lại schema.sql rồi auth_hooks.sql.
        </Hop>
      </div>
    )
  }
  if (!kh) notFound()

  const { data: ds } = await db.rpc('ke_hoach_thu_chi_tiet', { p_id: id })
  const rows = ds ?? []

  // Gom theo CĂN: bảng phẳng 468 × 3 dòng thì không ai đọc được, mà câu hỏi của
  // người trực ban luôn là "căn này còn mấy đợt".
  const theoCan = new Map<string, { ma_can: string; dien_tich: number | null; dot: typeof rows }>()
  for (const r of rows) {
    let g = theoCan.get(r.unit_id)
    if (!g) { g = { ma_can: r.ma_can, dien_tich: r.dien_tich, dot: [] }; theoCan.set(r.unit_id, g) }
    g.dot.push(r)
  }
  const can = [...theoCan.entries()].sort((a, b) => a[1].ma_can.localeCompare(b[1].ma_can, 'vi'))
  const soDot = kh.so_dot

  return (
    <div className="space-y-5">
      <PageHead
        breadcrumb={<Link href="/bql/tra-gop" className="hover:text-ink">← Thu theo đợt</Link>}
        title={kh.ten}
        sub={
          `${vnd(kh.tong_chi_phi)} · ${NHAN_CACH_CHIA[kh.cach_chia] ?? kh.cach_chia} · `
          + `${kh.so_can} căn · ${soDot} đợt từ kỳ ${kyVN(kh.ky_bat_dau)}`
        }
      />

      {kh.huy_luc && (
        <Hop tone="trung" title="Kế hoạch này đã dừng thu">
          Lý do: {kh.ly_do_huy?.trim() || 'không ghi'}. Các đợt đã nằm trên hóa đơn
          đã phát hành vẫn giữ nguyên; đợt chưa tới kỳ thì không thu nữa.
        </Hop>
      )}

      <Hop tone="trung" title={`Nghị quyết ${kh.nghi_quyet}`}>
        {kh.ngay_nq && <span className="block">Ngày {ngayVN(kh.ngay_nq)}.</span>}
        {kh.mo_ta && <span className="mt-1 block whitespace-pre-line">{kh.mo_ta}</span>}
        {kh.tong_dien_tich != null && (
          <span className="num mt-1 block">
            Mẫu số đóng băng lúc lập: {kh.tong_dien_tich.toLocaleString('vi-VN')} m².
          </span>
        )}
      </Hop>

      <Card>
        <CardHead title="Từng căn" sub={`${can.length} căn × ${soDot} đợt`} />
        <div className="scroll-x max-h-[36rem] overflow-auto">
          <Bang>
            <thead>
              <Tr>
                <Th>Căn</Th>
                <Th className="hidden text-right sm:table-cell">Diện tích</Th>
                <Th className="text-right">Tổng phải trả</Th>
                {Array.from({ length: soDot }, (_, i) => (
                  <Th key={i} className="text-right">Đợt {i + 1}</Th>
                ))}
              </Tr>
            </thead>
            <tbody>
              {can.map(([uid, g]) => {
                const tong = g.dot.reduce((t, d) => t + d.so_tien, 0)
                return (
                  <Tr key={uid}>
                    <Td className="num font-medium whitespace-nowrap">{g.ma_can}</Td>
                    <Td className="num hidden text-right whitespace-nowrap text-muted sm:table-cell">
                      {g.dien_tich != null ? `${g.dien_tich.toLocaleString('vi-VN')} m²` : '—'}
                    </Td>
                    <Td className="num text-right font-medium whitespace-nowrap">{vnd(tong)}</Td>
                    {Array.from({ length: soDot }, (_, i) => {
                      const d = g.dot.find((x) => x.thu_tu === i + 1)
                      if (!d) return <Td key={i} className="text-right text-faint">—</Td>
                      const t = trangThaiDot({ ...d, huy_luc: kh.huy_luc })
                      return (
                        <Td key={i} className="text-right whitespace-nowrap">
                          <span className={cx('num', t === 'con_thieu' && 'text-bad', t === 'da_tra' && 'text-ok')}>
                            {vnd(d.so_tien)}
                          </span>
                          <span className="mt-0.5 block text-[0.6875rem] text-faint">
                            {NHAN_DOT[t]}
                          </span>
                        </Td>
                      )
                    })}
                  </Tr>
                )
              })}
            </tbody>
          </Bang>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-[0.75rem]">
          {(Object.keys(NHAN_DOT) as (keyof typeof NHAN_DOT)[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <Pill tone={TONE_DOT[t]}>{NHAN_DOT[t]}</Pill>
            </span>
          ))}
        </div>
      </Card>

      <Hop tone="trung" title="Trạng thái ở đây là của TỜ HÓA ĐƠN, không phải của đợt">
        Đợt thu nằm chung hóa đơn với phí quản lý và tiền nước. &ldquo;Hóa đơn còn
        thiếu&rdquo; nghĩa là cả tờ hóa đơn của kỳ đó còn thiếu, chứ không phải
        riêng đợt này chưa trả — cư dân chuyển thiếu một phần thì không có cách
        nào tách ra phần thiếu thuộc dòng nào.
      </Hop>
    </div>
  )
}
