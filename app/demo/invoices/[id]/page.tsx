import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { buildVietQr, paymentRef } from '@/lib/vietqr'
import { HOA_DON, NGAN_HANG_DEMO } from '@/lib/demo/data'

const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export default async function DemoInvoiceDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inv = HOA_DON.find((h) => h.id === id)
  if (!inv) notFound()

  const conLai = inv.tong - inv.da_tra

  // Mã QR sinh bằng ĐÚNG lib/vietqr.ts của bản thật, không phải ảnh chụp màn
  // hình. Nhờ vậy demo cho thấy được cấu trúc mã thật; chỉ số tài khoản là giả.
  let qrDataUrl: string | null = null
  let noiDung: string | null = null
  if (conLai > 0) {
    noiDung = paymentRef(inv.can, inv.ky)
    qrDataUrl = await QRCode.toDataURL(
      buildVietQr({
        bin: NGAN_HANG_DEMO.bin,
        accountNumber: NGAN_HANG_DEMO.soTaiKhoan,
        amount: conLai,
        description: noiDung,
      }),
      { width: 320, margin: 1 },
    )
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-5">
      <Link href="/demo/invoices" className="text-sm underline">← Hóa đơn</Link>
      <div>
        <h1 className="text-2xl font-semibold">{inv.can}</h1>
        <p className="text-sm opacity-70">Kỳ {inv.ky.slice(0, 7)} · hạn {inv.han}</p>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {inv.dong.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="py-2">{l.mo_ta}</td>
              <td className="py-2 text-right opacity-70">
                {l.so_luong !== 1 && `${l.so_luong} × ${vnd(l.don_gia)}`}
              </td>
              <td className="py-2 text-right">{vnd(l.thanh_tien)}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-medium">
            <td className="py-2" colSpan={2}>Tổng</td>
            <td className="py-2 text-right">{vnd(inv.tong)}</td>
          </tr>
          {inv.da_tra > 0 && (
            <>
              <tr><td className="py-1" colSpan={2}>Đã trả</td>
                  <td className="py-1 text-right">{vnd(inv.da_tra)}</td></tr>
              <tr className="font-medium"><td className="py-1" colSpan={2}>Còn lại</td>
                  <td className="py-1 text-right">{vnd(conLai)}</td></tr>
            </>
          )}
        </tbody>
      </table>

      {conLai <= 0 && (
        <p className="rounded bg-green-100 p-3 text-green-900">Hóa đơn này đã thanh toán đủ.</p>
      )}

      {qrDataUrl && (
        <section className="space-y-2 rounded border p-4">
          <h2 className="font-medium">Quét để thanh toán</h2>
          <p className="rounded bg-red-100 p-2 text-sm text-red-900">
            <b>Mã QR demo — đừng quét để chuyển tiền.</b> Số tài khoản là dãy số
            giả ({NGAN_HANG_DEMO.soTaiKhoan}), không có nơi nào nhận.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Mã VietQR demo" className="w-64" />
          <dl className="text-sm">
            <div className="flex gap-2"><dt className="opacity-70">Số tiền</dt><dd>{vnd(conLai)}</dd></div>
            <div className="flex gap-2"><dt className="opacity-70">Nội dung</dt><dd><code>{noiDung}</code></dd></div>
          </dl>
          <p className="text-sm opacity-70">
            Giữ nguyên nội dung chuyển khoản — hệ thống dựa vào đó để gạch nợ tự động.
          </p>
        </section>
      )}
    </main>
  )
}
