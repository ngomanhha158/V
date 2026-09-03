import Link from 'next/link'
import { cx, ngayGioVN, vnd } from '@/components/ui'
import { hinhThuc, type LoaiDong } from '@/lib/phieu-thu'

// Bản demo của tờ phiếu. KHÔNG có vỏ app, giống hệt màn thật — vỏ nav in ra
// giấy là vô nghĩa, và người xem demo cần thấy đúng tờ giấy họ sẽ cầm.
//
// Ca được chọn: trả TRỌN một hóa đơn, nên phiếu liệt kê được từng khoản phí.
// Đây là ca thường gặp nhất và cũng là ca duy nhất mà việc liệt kê là trung thực.
const DONG: { id: string; loai: LoaiDong; dien_giai: string; so_tien: number }[] = [
  { id: '1', loai: 'hoa_don',  dien_giai: 'Hóa đơn kỳ 09/2026', so_tien: 1_406_000 },
  { id: '2', loai: 'chi_tiet', dien_giai: 'Phí quản lý 09/2026', so_tien: 1_287_000 },
  { id: '3', loai: 'chi_tiet', dien_giai: 'Nước 14 m³',          so_tien:   119_000 },
]

export default function Page() {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-12">
      <div className="no-print flex items-center justify-between">
        <Link href="/demo/bql/phieu-thu" className="text-[0.8125rem] font-medium text-muted hover:text-ink">
          ← Sổ phiếu thu
        </Link>
        <span className="rounded-lg border border-line-firm px-3.5 py-2 text-sm font-medium text-ink">
          In / Lưu PDF
        </span>
      </div>

      <div className="giay rounded-card border border-line bg-surface">
        <div className="border-b border-line px-5 py-4 text-center">
          <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-faint uppercase">
            Phiếu thu
          </p>
          <p className="num mt-1 text-[1.375rem] leading-tight font-bold tracking-wide text-ink">
            PT-2609-0184
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">Sunrise Riverside</p>
        </div>

        <dl className="divide-y divide-line px-5 text-sm">
          <Dong nhan="Căn hộ" giatri="P1-12.04" />
          <Dong nhan="Người nộp" giatri="Trần Thị Bích Ngọc" />
          <Dong nhan="Ngày nhận tiền" giatri={ngayGioVN('2026-09-03T02:12:00Z')} />
          <Dong nhan="Hình thức" giatri={hinhThuc('chuyen_khoan')} />
        </dl>

        <div className="border-t border-line px-5 py-3">
          <table className="w-full text-sm">
            <tbody>
              {DONG.map((d) => (
                <tr key={d.id} className={d.loai === 'chi_tiet' ? '' : 'border-t border-line first:border-0'}>
                  <td className={cx('py-1.5 pr-3', d.loai === 'chi_tiet' && 'pl-4 text-[0.8125rem] text-faint')}>
                    {d.loai === 'chi_tiet' && <span className="mr-1.5 text-faint">·</span>}
                    {d.dien_giai}
                  </td>
                  <td className={cx('num py-1.5 text-right whitespace-nowrap',
                    d.loai === 'chi_tiet' ? 'text-[0.8125rem] text-faint' : 'font-medium text-ink')}>
                    {vnd(d.so_tien)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-baseline justify-between border-t-2 border-line-firm px-5 py-3.5">
          <span className="text-sm font-semibold text-ink">Tổng thu</span>
          <span className="num text-xl font-bold text-ink">{vnd(1_406_000)}</span>
        </div>

        <p className="border-t border-line px-5 py-2.5 text-[0.75rem] text-faint">
          Lập lúc {ngayGioVN('2026-09-03T02:12:31Z')}. Chứng từ điện tử, có giá trị không cần chữ ký.
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
