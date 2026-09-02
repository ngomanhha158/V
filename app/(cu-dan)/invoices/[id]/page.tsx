import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/db/server'
import { buildVietQr, paymentRef } from '@/lib/vietqr'
import { bankConfig } from '@/lib/bank'
import { Card, CardHead, Hop, PageHead, Pill, cx, ngayVN, vnd } from '@/components/ui'
import { IcTrai } from '@/components/icons'

export const dynamic = 'force-dynamic'

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
  const tre = conLai > 0 && String(inv.due_date) < new Date().toISOString().slice(0, 10)
  const bank = bankConfig()

  // QR chỉ có nghĩa khi còn nợ. Trả xong rồi mà vẫn hiện QR là mời người ta
  // chuyển thừa một lần nữa.
  let qrDataUrl: string | null = null
  let noiDung: string | null = null
  let qrError: string | null = null

  if (bank && conLai > 0 && inv.units?.code) {
    noiDung = paymentRef(inv.units.code, String(inv.period))
    try {
      qrDataUrl = await QRCode.toDataURL(
        buildVietQr({
          bin: bank.bin, accountNumber: bank.accountNumber,
          amount: conLai, description: noiDung,
        }),
        { width: 480, margin: 0, color: { dark: '#101828', light: '#ffffff' } },
      )
    } catch (e) {
      // Cấu hình ngân hàng sai -> nói ra, đừng hiện QR hỏng cho người ta quét.
      qrError = e instanceof Error ? e.message : 'Không tạo được mã QR'
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
      >
        <IcTrai width={16} height={16} /> Hóa đơn
      </Link>

      <PageHead
        title={`Kỳ ${String(inv.period).slice(5, 7)}/${String(inv.period).slice(0, 4)}`}
        sub={`${inv.units?.code} · hạn thanh toán ${ngayVN(String(inv.due_date))}`}
        actions={
          <Pill tone={conLai <= 0 ? 'tot' : tre ? 'xau' : 'canh'}>
            {conLai <= 0 ? 'Đã thanh toán' : tre ? 'Quá hạn' : 'Chưa thanh toán'}
          </Pill>
        }
      />

      <Card>
        <CardHead title="Chi tiết các khoản" />
        <div className="px-4">
          <table className="w-full text-sm">
            <tbody>
              {lines?.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-medium text-ink">{l.description}</div>
                    {Number(l.quantity) !== 1 && (
                      <div className="num mt-0.5 text-[0.75rem] text-faint">
                        {Number(l.quantity).toLocaleString('vi-VN')} × {vnd(l.unit_price)}
                      </div>
                    )}
                  </td>
                  <td className="num py-3 text-right font-medium text-ink">{vnd(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 border-t border-line bg-raised px-4 py-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Tổng cộng</span>
            <span className="num font-medium text-ink">{vnd(inv.total_amount)}</span>
          </div>
          {inv.paid_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Đã thanh toán</span>
              <span className="num font-medium text-ok">− {vnd(inv.paid_amount)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-line pt-2 text-sm">
            <span className="font-semibold text-ink">Còn phải trả</span>
            <span className={cx('num text-lg font-semibold', conLai > 0 ? 'text-ink' : 'text-ok')}>
              {vnd(Math.max(conLai, 0))}
            </span>
          </div>
        </div>
      </Card>

      {conLai <= 0 && (
        <Hop tone="tot" title="Hóa đơn đã thanh toán đủ">
          Không còn khoản nào phải trả cho kỳ này.
        </Hop>
      )}

      {conLai > 0 && !bank && (
        <Hop tone="canh" title="Chưa cấu hình tài khoản nhận tiền">
          Vì thế chưa có mã QR. Liên hệ BQL để lấy thông tin chuyển khoản.
        </Hop>
      )}

      {qrError && <Hop tone="xau" title="Không tạo được mã QR">{qrError}</Hop>}

      {qrDataUrl && (
        <Card>
          <CardHead title="Quét mã để thanh toán" sub="VietQR — mở app ngân hàng và quét" />
          <div className="space-y-4 p-4">
            {/* Nền trắng cố định quanh mã: máy quét cần tương phản tối-trên-sáng,
                để mã lọt vào nền tối là điện thoại không đọc ra. */}
            <div className="flex justify-center">
              <div className="rounded-xl border border-line bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Mã VietQR" className="size-52" />
              </div>
            </div>

            <dl className="rounded-ctl border border-line bg-raised px-3.5 py-1 text-sm">
              <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
                <dt className="text-muted">Số tiền</dt>
                <dd className="num font-semibold text-ink">{vnd(conLai)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-muted">Nội dung</dt>
                <dd className="min-w-0 text-right">
                  <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.8125rem] text-ink">
                    {noiDung}
                  </code>
                </dd>
              </div>
            </dl>

            <p className="text-[0.75rem] leading-relaxed text-faint">
              Giữ nguyên nội dung chuyển khoản — hệ thống dựa vào đó để gạch nợ
              tự động. Sửa đi thì phải chờ BQL đối chiếu tay.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
