import { cx, ngayVN, vnd } from '@/components/ui'

/**
 * Hóa đơn ở dạng CHỨNG TỪ — thứ in ra giấy hoặc lưu PDF được.
 *
 * Vì sao tách khỏi màn /invoices/[id] mà không dựng một route in riêng: một
 * route riêng nghĩa là hai lần đọc database và hai chỗ cộng tiền. Sau một lần
 * trả góp, tờ giấy in ra và màn hình cư dân đang mở sẽ nói hai con số khác
 * nhau — và người cầm tờ giấy đi hỏi BQL là người biết cuối cùng.
 *
 * Nên: một trang, một lần đọc, một phép cộng. Màn hình bọc phần vỏ của nó
 * trong `no-print`; phần dưới đây là thứ ra giấy.
 *
 * MÃ QR NẰM TRONG chứng từ, không phải ở một thẻ riêng bên dưới. Tờ hóa đơn in
 * ra là để đưa cho người KHÔNG dùng app — cắt mã QR đi thì họ cầm một tờ giấy
 * ghi số tiền mà không có cách nào trả, và phải gọi lên BQL hỏi số tài khoản.
 */
export function HoaDonGiay({
  tenKhu, maCan, ky, hanTra, dong, tong, daTra, qr, noiDung,
}: {
  tenKhu: string | null
  maCan: string | null
  /** Dạng YYYY-MM-DD (cột period). */
  ky: string
  hanTra: string
  dong: { id: string; description: string; quantity: number; unit_price: number; amount: number }[]
  tong: number
  daTra: number
  /** data: URL của mã VietQR, hoặc null khi không còn nợ / chưa cấu hình. */
  qr: string | null
  noiDung: string | null
}) {
  const conLai = tong - daTra
  const treHan = conLai > 0 && hanTra < new Date().toISOString().slice(0, 10)

  return (
    <div className="giay rounded-card border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 text-center">
        <p className="text-[0.6875rem] font-semibold tracking-[0.18em] text-faint uppercase">
          Thông báo phí
        </p>
        <p className="num mt-1 text-[1.375rem] leading-tight font-bold tracking-wide text-ink">
          Kỳ {ky.slice(5, 7)}/{ky.slice(0, 4)}
        </p>
        {tenKhu && <p className="mt-1 text-[0.8125rem] text-muted">{tenKhu}</p>}
      </div>

      <dl className="divide-y divide-line px-5 text-sm">
        <div className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-muted">Căn hộ</dt>
          <dd className="num font-medium text-ink">{maCan ?? '—'}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-muted">Hạn thanh toán</dt>
          <dd className={cx('num font-medium', treHan ? 'text-bad' : 'text-ink')}>
            {ngayVN(hanTra)}{treHan && ' · đã quá hạn'}
          </dd>
        </div>
      </dl>

      <div className="border-t border-line px-5 py-3">
        <table className="w-full text-sm">
          <tbody>
            {dong.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="py-2 pr-3">
                  <div className="text-ink">{l.description}</div>
                  {Number(l.quantity) !== 1 && (
                    <div className="num mt-0.5 text-[0.75rem] text-faint">
                      {Number(l.quantity).toLocaleString('vi-VN')} × {vnd(l.unit_price)}
                    </div>
                  )}
                </td>
                <td className="num py-2 text-right whitespace-nowrap text-ink">{vnd(l.amount)}</td>
              </tr>
            ))}
            {dong.length === 0 && (
              // Hóa đơn không có dòng phí nào vẫn phải hiện ra: đó là chuyện
              // cần biết, không phải chuyện để giấu đi.
              <tr>
                <td className="py-2 text-[0.8125rem] text-faint" colSpan={2}>
                  Hóa đơn này chưa có dòng phí nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 border-t border-line px-5 py-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Tổng cộng</span>
          <span className="num font-medium text-ink">{vnd(tong)}</span>
        </div>
        {daTra > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted">Đã thanh toán</span>
            <span className="num font-medium text-ok">− {vnd(daTra)}</span>
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between border-t-2 border-line-firm px-5 py-3.5">
        <span className="text-sm font-semibold text-ink">Còn phải trả</span>
        <span className={cx('num text-xl font-bold', conLai > 0 ? 'text-ink' : 'text-ok')}>
          {vnd(Math.max(conLai, 0))}
        </span>
      </div>

      {qr && noiDung && (
        <div className="border-t border-line px-5 py-4">
          <p className="text-center text-[0.6875rem] font-semibold tracking-[0.14em] text-faint uppercase">
            Quét mã để chuyển khoản
          </p>
          {/* Nền trắng cố định quanh mã: máy quét cần tương phản tối-trên-sáng. */}
          <div className="mt-3 flex justify-center">
            <div className="rounded-xl border border-line bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Mã VietQR" className="size-44" />
            </div>
          </div>
          <p className="mt-3 text-center text-[0.75rem] text-muted">
            Nội dung chuyển khoản —{' '}
            <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">
              {noiDung}
            </code>
          </p>
          <p className="mt-1.5 text-center text-[0.75rem] leading-relaxed text-faint">
            Giữ nguyên nội dung này — hệ thống dựa vào đó để gạch nợ tự động.
          </p>
        </div>
      )}

      <p className="border-t border-line px-5 py-2.5 text-[0.75rem] text-faint">
        Chứng từ điện tử, có giá trị không cần chữ ký. Đã thanh toán rồi thì
        phiếu thu là chứng từ đối chiếu, không phải tờ này.
      </p>
    </div>
  )
}
