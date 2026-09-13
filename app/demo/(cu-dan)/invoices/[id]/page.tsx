import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { buildVietQr, paymentRef } from '@/lib/vietqr'
import { HOA_DON, NGAN_HANG_DEMO } from '@/lib/demo/data'
import { Hop, Pill } from '@/components/ui'
import { HoaDonGiay } from '@/components/hoa-don-giay'
import { NutIn } from '@/components/nut-in'
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
      <div className="no-print flex items-center justify-between gap-3">
        <Link
          href="/demo/invoices"
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
        >
          <IcTrai width={16} height={16} /> Hóa đơn
        </Link>
        <div className="flex items-center gap-2">
          <Pill tone={conLai <= 0 ? 'tot' : tre ? 'xau' : 'canh'}>
            {conLai <= 0 ? 'Đã thanh toán' : tre ? 'Quá hạn' : 'Chưa thanh toán'}
          </Pill>
          <NutIn />
        </div>
      </div>

      {qr && (
        <Hop className="no-print" tone="xau" title="Mã QR demo — đừng quét để chuyển tiền">
          Số tài khoản là dãy số giả ({NGAN_HANG_DEMO.soTaiKhoan}), không có nơi nào nhận.
        </Hop>
      )}

      {/* CÙNG một component với bản thật. Bản demo là thứ người ta xem trước
          khi quyết định mua — dựng lại chứng từ bằng tay ở đây thì sớm muộn nó
          hiện một tờ giấy mà hệ thống thật không in ra được. */}
      <HoaDonGiay
        tenKhu="Khu demo Sunrise Riverside"
        maCan={inv.can}
        ky={inv.ky}
        hanTra={inv.han}
        dong={inv.dong.map((l) => ({
          id: l.id, description: l.mo_ta,
          quantity: l.so_luong, unit_price: l.don_gia, amount: l.thanh_tien,
        }))}
        tong={inv.tong}
        daTra={inv.da_tra}
        qr={qr}
        noiDung={noiDung}
      />

      {conLai <= 0 && (
        <Hop className="no-print" tone="tot" title="Hóa đơn đã thanh toán đủ">
          Không còn khoản nào phải trả cho kỳ này.
        </Hop>
      )}
    </div>
  )
}
