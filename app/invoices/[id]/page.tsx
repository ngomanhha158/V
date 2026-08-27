import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { buildVietQr, paymentRef } from '@/lib/vietqr'
import { bankConfig } from '@/lib/bank'

export const dynamic = 'force-dynamic'

const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: inv } = await supabase
    .from('invoices')
    .select('id, period, total_amount, paid_amount, status, due_date, units(code)')
    .eq('id', id)
    .maybeSingle()
  if (!inv) notFound()

  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('id, description, quantity, unit_price, amount')
    .eq('invoice_id', id)

  const conLai = inv.total_amount - inv.paid_amount
  const bank = bankConfig()

  // QR chỉ có nghĩa khi còn nợ. Trả xong rồi mà vẫn hiện QR là mời người ta
  // chuyển thừa một lần nữa.
  let qrDataUrl: string | null = null
  let noiDung: string | null = null
  let qrError: string | null = null

  if (bank && conLai > 0 && inv.units?.code) {
    noiDung = paymentRef(inv.units.code, String(inv.period))
    try {
      const payload = buildVietQr({
        bin: bank.bin,
        accountNumber: bank.accountNumber,
        amount: conLai,
        description: noiDung,
      })
      qrDataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 })
    } catch (e) {
      // Cấu hình ngân hàng sai -> nói ra, đừng hiện QR hỏng cho người ta quét.
      qrError = e instanceof Error ? e.message : 'Không tạo được mã QR'
    }
  }

  return (
    <main className="space-y-5">
      <Link href="/invoices" className="text-sm underline">← Hóa đơn</Link>
      <div>
        <h1 className="text-2xl font-semibold">{inv.units?.code}</h1>
        <p className="text-sm opacity-70">
          Kỳ {String(inv.period).slice(0, 7)} · hạn {String(inv.due_date)}
        </p>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {lines?.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-right opacity-70">
                {Number(l.quantity) !== 1 && `${l.quantity} × ${vnd(l.unit_price)}`}
              </td>
              <td className="py-2 text-right">{vnd(l.amount)}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-medium">
            <td className="py-2" colSpan={2}>Tổng</td>
            <td className="py-2 text-right">{vnd(inv.total_amount)}</td>
          </tr>
          {inv.paid_amount > 0 && (
            <>
              <tr><td className="py-1" colSpan={2}>Đã trả</td>
                  <td className="py-1 text-right">{vnd(inv.paid_amount)}</td></tr>
              <tr className="font-medium"><td className="py-1" colSpan={2}>Còn lại</td>
                  <td className="py-1 text-right">{vnd(conLai)}</td></tr>
            </>
          )}
        </tbody>
      </table>

      {conLai <= 0 && (
        <p className="rounded bg-green-100 p-3 text-green-900">Hóa đơn này đã thanh toán đủ.</p>
      )}

      {conLai > 0 && !bank && (
        <p className="rounded bg-amber-100 p-3 text-sm text-amber-900">
          Chưa cấu hình tài khoản nhận tiền nên chưa có mã QR. Liên hệ BQL để lấy thông tin chuyển khoản.
        </p>
      )}

      {qrError && <p className="rounded bg-red-100 p-3 text-sm text-red-900">{qrError}</p>}

      {qrDataUrl && (
        <section className="space-y-2 rounded border p-4">
          <h2 className="font-medium">Quét để thanh toán</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Mã VietQR" className="w-64" />
          <dl className="text-sm">
            <div className="flex gap-2"><dt className="opacity-70">Số tiền</dt><dd>{vnd(conLai)}</dd></div>
            <div className="flex gap-2"><dt className="opacity-70">Nội dung</dt><dd><code>{noiDung}</code></dd></div>
          </dl>
          <p className="text-sm opacity-70">
            Giữ nguyên nội dung chuyển khoản — hệ thống dựa vào đó để gạch nợ tự động.
            Sửa đi thì phải chờ BQL đối chiếu tay.
          </p>
        </section>
      )}
    </main>
  )
}
