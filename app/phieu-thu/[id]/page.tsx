import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { Hop, cx, ngayGioVN, vnd } from '@/components/ui'
import { hinhThuc, loiHuy, tongDong, type LoaiDong } from '@/lib/phieu-thu'
import { NutIn } from './nut-in'

/**
 * Tờ phiếu thu — thứ cư dân cầm được sau khi chuyển khoản.
 *
 * KHÔNG có vỏ app: thanh nav in ra giấy là vô nghĩa, và trên điện thoại nó ăn
 * mất chỗ của đúng thứ người ta mở trang này để xem. Cùng lý do với màn quét thẻ.
 *
 * "Tải PDF" làm bằng hộp thoại in của trình duyệt chứ không dựng bộ sinh PDF ở
 * máy chủ. Mọi trình duyệt đều có sẵn "Lưu thành PDF" trong hộp thoại đó, kể cả
 * trên điện thoại; thêm một thư viện render PDF vào server để làm lại việc đó
 * là gánh nặng cho một trang giấy. Đổi lại còn được cái BQT hay hỏi: in ra giấy.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const { data: p } = await db
    .from('phieu_thu')
    .select('id, so_phieu, ky, unit_id, nguoi_nop, ma_can, tong_thu, hinh_thuc, nhan_luc, lap_luc, huy_luc, ly_do_huy, projects(name)')
    .eq('id', id)
    .maybeSingle()
  // Không phân biệt "không có" với "không được xem": nói "cấm" là xác nhận tờ
  // phiếu đó có thật, và số chứng từ thì đoán được.
  if (!p) notFound()

  const { data: dong } = await db
    .from('phieu_thu_dong')
    .select('id, thu_tu, loai, dien_giai, so_tien')
    .eq('phieu_id', id)
    .order('thu_tu')

  const ds = (dong ?? []).map((d) => ({ ...d, loai: d.loai as LoaiDong }))
  const tong = tongDong(ds)
  const daHuy = !!p.huy_luc
  const huy = loiHuy(p.ly_do_huy)

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-12">
      <div className="no-print flex items-center justify-between">
        <Link href="/invoices" className="text-[0.8125rem] font-medium text-muted hover:text-ink">
          ← Hóa đơn
        </Link>
        <NutIn />
      </div>

      {daHuy && <Hop tone="xau" title={huy.tieu}>{huy.than}</Hop>}

      <div className={cx('giay rounded-card border border-line bg-surface', daHuy && 'opacity-60')}>
        <div className="border-b border-line px-5 py-4 text-center">
          <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-faint uppercase">
            Phiếu thu
          </p>
          {/* Số chứng từ là thứ người ta đọc qua điện thoại cho kế toán nghe,
              nên nó to và tách chữ ra, không nằm lẫn trong một dòng phụ. */}
          <p className="num mt-1 text-[1.375rem] leading-tight font-bold tracking-wide text-ink">
            {p.so_phieu}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">{p.projects?.name}</p>
        </div>

        <dl className="divide-y divide-line px-5 text-sm">
          <Dong nhan="Căn hộ" giatri={p.ma_can} />
          <Dong nhan="Người nộp" giatri={p.nguoi_nop || '—'} />
          <Dong nhan="Ngày nhận tiền" giatri={ngayGioVN(p.nhan_luc)} />
          <Dong nhan="Hình thức" giatri={hinhThuc(p.hinh_thuc)} />
        </dl>

        <div className="border-t border-line px-5 py-3">
          <table className="w-full text-sm">
            <tbody>
              {ds.map((d) => (
                <tr key={d.id} className={d.loai === 'chi_tiet' ? '' : 'border-t border-line first:border-0'}>
                  <td className={cx('py-1.5 pr-3', d.loai === 'chi_tiet' && 'pl-4 text-[0.8125rem] text-faint')}>
                    {d.loai === 'chi_tiet' && <span className="mr-1.5 text-faint">·</span>}
                    {d.dien_giai}
                  </td>
                  <td
                    className={cx(
                      'num py-1.5 text-right whitespace-nowrap',
                      d.loai === 'chi_tiet'
                        ? 'text-[0.8125rem] text-faint'
                        : 'font-medium text-ink',
                    )}
                  >
                    {vnd(d.so_tien)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-baseline justify-between border-t-2 border-line-firm px-5 py-3.5">
          <span className="text-sm font-semibold text-ink">Tổng thu</span>
          <span className="num text-xl font-bold text-ink">{vnd(p.tong_thu)}</span>
        </div>

        {/* Chốt tự kiểm chạy cả ở màn hình. Database đã chặn phiếu lệch từ lúc
            lập, nên dòng này lẽ ra không bao giờ hiện — nhưng nếu nó hiện thì
            người cầm tờ phiếu là người đầu tiên cần biết, không phải người
            cuối cùng. */}
        {tong !== p.tong_thu && (
          <div className="border-t border-bad-line bg-bad-soft px-5 py-3 text-[0.8125rem] text-bad">
            Phiếu này không cân: các dòng cộng lại là {vnd(tong)} nhưng tổng thu ghi{' '}
            {vnd(p.tong_thu)}. Đừng dùng nó để đối chiếu — báo BQL.
          </div>
        )}

        <p className="border-t border-line px-5 py-2.5 text-[0.75rem] text-faint">
          Lập lúc {ngayGioVN(p.lap_luc)}. Chứng từ điện tử, có giá trị không cần chữ ký.
        </p>
      </div>

      <p className="no-print text-[0.8125rem] leading-relaxed text-muted">
        Số chứng từ này dùng để tra khi đối chiếu với BQL. Cần bản PDF thì bấm{' '}
        <strong>In</strong> rồi chọn <em>Lưu thành PDF</em> trong hộp thoại của máy.
      </p>
    </div>
  )
}

function Dong({ nhan, giatri }: { nhan: string; giatri: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted">{nhan}</dt>
      <dd className="text-right font-medium text-ink">{giatri}</dd>
    </div>
  )
}
