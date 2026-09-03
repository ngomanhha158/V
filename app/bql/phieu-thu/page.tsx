import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, Trong, ngayGioVN, vnd } from '@/components/ui'
import { loiLienTuc } from '@/lib/phieu-thu'
import { NutHuy } from './form'

/**
 * Sổ phiếu thu của một kỳ.
 *
 * Câu hỏi đầu tiên khi kiểm toán mở sổ ra là "dãy số có đứt không", nên câu trả
 * lời nằm ngay đầu trang chứ không nằm sau một nút bấm nào. Trang này tồn tại
 * chủ yếu để trả lời đúng câu đó.
 */
export const dynamic = 'force-dynamic'

const thangHopLe = (v: string | undefined) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null)

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ky?: string }>
}) {
  const sp = await searchParams
  const nay = new Date()
  const macDinh = `${nay.getFullYear()}-${String(nay.getMonth() + 1).padStart(2, '0')}`
  const thang = thangHopLe(sp.ky) ?? macDinh
  const ky = `${thang}-01`

  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Phiếu thu" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const [{ data: ds, error }, { data: lo }] = await Promise.all([
    db.rpc('bql_so_phieu_thu', { p_project: project.id, p_ky: ky }),
    db.rpc('kiem_lien_tuc_phieu_thu', { p_project: project.id, p_ky: ky }),
  ])

  const rows = ds ?? []
  const thieu = (lo ?? []).map((r) => r.thieu_stt)
  // Số phiếu ĐÃ CẤP trong kỳ = số cuối cùng, không phải số dòng đọc được: một
  // phiếu bị xóa khỏi bảng vẫn đã tiêu một số, và đó đúng là thứ cần đếm.
  const daCap = Math.max(rows.at(-1)?.stt ?? 0, ...thieu, 0)
  const kiem = loiLienTuc(ky, thieu, daCap)
  const conHieuLuc = rows.filter((r) => !r.da_huy)
  const tongThu = conHieuLuc.reduce((t, r) => t + r.tong_thu, 0)

  const truoc = dichThang(thang, -1)
  const sau = dichThang(thang, 1)

  return (
    <div className="space-y-5">
      <PageHead
        title="Phiếu thu"
        sub="Chứng từ cấp cho từng lần tiền về — dãy số phải liền mạch trong kỳ"
        actions={
          <div className="flex items-center gap-1.5">
            <Link
              href={`/bql/phieu-thu?ky=${truoc}`}
              className="rounded-lg border border-line-firm px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted hover:bg-sunken hover:text-ink"
            >
              ←
            </Link>
            <span className="num px-1 text-sm font-semibold text-ink">
              {thang.slice(5)}/{thang.slice(0, 4)}
            </span>
            <Link
              href={`/bql/phieu-thu?ky=${sau}`}
              className="rounded-lg border border-line-firm px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted hover:bg-sunken hover:text-ink"
            >
              →
            </Link>
          </div>
        }
      />

      {error && (
        <Hop tone="xau" title="Không đọc được sổ phiếu thu">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần phiếu thu chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {!error && (
        <Hop tone={kiem.ok ? 'tot' : 'xau'} title={kiem.ok ? 'Dãy số nguyên vẹn' : 'DÃY SỐ BỊ ĐỨT'}>
          {kiem.loi}
        </Hop>
      )}

      <Card>
        <CardHead
          title={`${rows.length} phiếu trong kỳ`}
          sub={
            rows.length === 0
              ? undefined
              : `Còn hiệu lực ${conHieuLuc.length} phiếu · tổng ${vnd(tongThu)}`
          }
        />
        {rows.length === 0 ? (
          <div className="p-4">
            <Trong title="Kỳ này chưa có phiếu thu nào">
              Phiếu sinh ra tự động mỗi khi một khoản tiền được gạch vào căn, ở màn{' '}
              <strong>Đối soát tiền về</strong>. Không có phiếu nào nghĩa là chưa có
              đồng nào được gạch trong kỳ này.
            </Trong>
          </div>
        ) : (
          <div className="scroll-x overflow-x-auto">
            <Bang>
              <thead>
                <Tr>
                  <Th>Số chứng từ</Th>
                  <Th>Ngày nhận tiền</Th>
                  <Th>Căn</Th>
                  <Th>Người nộp</Th>
                  <Th className="text-right">Tổng thu</Th>
                  <Th />
                </Tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id} className={r.da_huy ? 'opacity-60' : undefined}>
                    <Td>
                      {/* Số chứng từ KHÔNG được xuống dòng. Đây là con số người
                          ta đọc qua điện thoại cho kế toán nghe; cắt "PT-2609-"
                          khỏi "0184" là mời đọc nhầm. Bảng đã cuộn ngang được
                          rồi, cuộn thì hơn. */}
                      <Link
                        href={`/phieu-thu/${r.id}`}
                        className="num font-medium whitespace-nowrap text-brand hover:underline"
                      >
                        {r.so_phieu}
                      </Link>
                      {r.da_huy && (
                        <div className="mt-1 text-[0.75rem] text-bad">
                          Đã hủy — {r.ly_do_huy}
                        </div>
                      )}
                    </Td>
                    <Td className="num whitespace-nowrap text-muted">{ngayGioVN(r.nhan_luc)}</Td>
                    <Td className="num font-medium whitespace-nowrap">{r.ma_can}</Td>
                    <Td>{r.nguoi_nop || <span className="text-faint">—</span>}</Td>
                    <Td className="num text-right font-medium">{vnd(r.tong_thu)}</Td>
                    <Td className="text-right">
                      {r.da_huy ? (
                        <Pill tone="xau">Đã hủy</Pill>
                      ) : (
                        <NutHuy id={r.id} soPhieu={r.so_phieu} />
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Bang>
          </div>
        )}
      </Card>

      <Hop tone="trung" title="Hủy phiếu không phải là hoàn tiền">
        Hủy chỉ bỏ tờ chứng từ — khoản tiền vẫn nằm nguyên trong hệ thống và hóa
        đơn vẫn được ghi là đã trả. Ghi nhầm căn thì hủy phiếu rồi sang{' '}
        <Link href="/bql/doi-soat" className="font-medium text-brand hover:underline">
          Đối soát tiền về
        </Link>{' '}
        gạch lại cho đúng căn; phiếu mới sẽ mang số mới.
      </Hop>
    </div>
  )
}

function dichThang(thang: string, buoc: number) {
  const [y, m] = thang.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + buoc, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
