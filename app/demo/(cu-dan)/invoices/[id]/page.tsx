import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { buildVietQr, paymentRef } from '@/lib/vietqr'
import { HOA_DON, NGAN_HANG_DEMO } from '@/lib/demo/data'
import { Card, CardHead, Hop, PageHead, Pill, cx, ngayVN, vnd } from '@/components/ui'
import { IcTrai } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function DemoInvoiceDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inv = HOA_DON.find((h) => h.id === id)
  if (!inv) notFound()

  const conLai = inv.tong - inv.da_tra
  const tre = conLai > 0 && inv.han < new Date().toISOString().slice(0, 10)

  // Mã sinh bằng ĐÚNG lib/vietqr.ts của bản thật, không phải ảnh chụp — demo
  // vì thế cho thấy đúng cấu trúc mã, chỉ số tài khoản là giả.
  let qr: string | null = null
  let noiDung: string | null = null
  if (conLai > 0) {
    noiDung = paymentRef(inv.can, inv.ky)
    qr = await QRCode.toDataURL(
      buildVietQr({
        bin: NGAN_HANG_DEMO.bin,
        accountNumber: NGAN_HANG_DEMO.soTaiKhoan,
        amount: conLai,
        description: noiDung,
      }),
      { width: 480, margin: 0, color: { dark: '#101828', light: '#ffffff' } },
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href="/demo/invoices"
        className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
      >
        <IcTrai width={16} height={16} /> Hóa đơn
      </Link>

      <PageHead
        title={`Kỳ ${inv.ky.slice(5, 7)}/${inv.ky.slice(0, 4)}`}
        sub={`${inv.can} · hạn thanh toán ${ngayVN(inv.han)}`}
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
              {inv.dong.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-3">
                    <div className="font-medium text-ink">{l.mo_ta}</div>
                    {l.so_luong !== 1 && (
                      <div className="num mt-0.5 text-[0.75rem] text-faint">
                        {l.so_luong.toLocaleString('vi-VN')} × {vnd(l.don_gia)}
                      </div>
                    )}
                  </td>
                  <td className="num py-3 text-right font-medium text-ink">{vnd(l.thanh_tien)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 border-t border-line bg-raised px-4 py-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Tổng cộng</span>
            <span className="num font-medium text-ink">{vnd(inv.tong)}</span>
          </div>
          {inv.da_tra > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Đã thanh toán</span>
              <span className="num font-medium text-ok">− {vnd(inv.da_tra)}</span>
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

      {qr && (
        <Card>
          <CardHead title="Quét mã để thanh toán" sub="VietQR — mở app ngân hàng và quét" />
          <div className="space-y-4 p-4">
            <Hop tone="xau" title="Mã QR demo — đừng quét để chuyển tiền">
              Số tài khoản là dãy số giả ({NGAN_HANG_DEMO.soTaiKhoan}), không có nơi nào nhận.
            </Hop>

            {/* Nền trắng cố định quanh mã: máy quét cần tương phản tối-trên-sáng,
                để mã lọt vào nền tối là điện thoại không đọc ra. */}
            <div className="flex justify-center">
              <div className="rounded-xl border border-line bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Mã VietQR" className="size-52" />
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
