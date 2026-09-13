import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/db/server'
import { buildVietQr, paymentRef } from '@/lib/vietqr'
import { bankConfigKhu } from '@/lib/bank'
import { Card, CardHead, Hop, Pill, cx, ngayVN, vnd } from '@/components/ui'
import { IcTrai } from '@/components/icons'
import { HoaDonGiay } from '@/components/hoa-don-giay'
import { NutIn } from '@/components/nut-in'

export const dynamic = 'force-dynamic'

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const { data: inv } = await db
    .from('invoices')
    .select(`id, project_id, period, total_amount, paid_amount, status, due_date,
             units(code), projects(name)`)
    .eq('id', id)
    .maybeSingle()
  if (!inv) notFound()

  const { data: lines } = await db
    .from('invoice_lines')
    .select('id, description, quantity, unit_price, amount')
    .eq('invoice_id', id)

  // Phiếu thu của CHÍNH hóa đơn này. Cư dân đi tìm biên nhận thì tìm ở đây —
  // chỗ họ đang đứng khi nhớ ra là mình đã trả rồi — chứ không phải ở một mục
  // riêng nào đó trong menu.
  const { data: dongPhieu } = await db
    .from('phieu_thu_dong')
    .select('phieu_id, so_tien')
    .eq('invoice_id', id)
    .eq('loai', 'hoa_don')
  const idPhieu = [...new Set((dongPhieu ?? []).map((d) => d.phieu_id))]
  const { data: phieu } = idPhieu.length
    ? await db
        .from('phieu_thu')
        .select('id, so_phieu, nhan_luc, tong_thu, huy_luc')
        .in('id', idPhieu)
        .order('nhan_luc')
    : { data: [] }

  const conLai = inv.total_amount - inv.paid_amount
  const tre = conLai > 0 && String(inv.due_date) < new Date().toISOString().slice(0, 10)
  const bank = await bankConfigKhu(inv.project_id)

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
      <div className="no-print flex items-center justify-between gap-3">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
        >
          <IcTrai width={16} height={16} /> Hóa đơn
        </Link>
        <div className="flex items-center gap-2">
          {/* Nhãn trạng thái ở lại MÀN HÌNH, không ra giấy: trên giấy thì dòng
              "Còn phải trả" và ngày quá hạn đã nói đủ, còn một con dấu "CHƯA
              THANH TOÁN" in kèm sẽ thành sai ngay hôm sau nếu người ta vừa trả. */}
          <Pill tone={conLai <= 0 ? 'tot' : tre ? 'xau' : 'canh'}>
            {conLai <= 0 ? 'Đã thanh toán' : tre ? 'Quá hạn' : 'Chưa thanh toán'}
          </Pill>
          <NutIn />
        </div>
      </div>

      {/* Chứng từ. Đây là thứ DUY NHẤT ra giấy — mọi thẻ khác trên màn này đều
          mang no-print, vì danh sách phiếu thu và mấy hộp nhắc việc là thứ để
          bấm vào chứ không phải thứ để cầm. */}
      <HoaDonGiay
        tenKhu={inv.projects?.name ?? null}
        maCan={inv.units?.code ?? null}
        ky={String(inv.period)}
        hanTra={String(inv.due_date)}
        dong={(lines ?? []).map((l) => ({
          id: l.id, description: l.description,
          quantity: Number(l.quantity), unit_price: l.unit_price, amount: l.amount,
        }))}
        tong={inv.total_amount}
        daTra={inv.paid_amount}
        qr={qrDataUrl}
        noiDung={noiDung}
      />

      {conLai <= 0 && (
        <Hop className="no-print" tone="tot" title="Hóa đơn đã thanh toán đủ">
          Không còn khoản nào phải trả cho kỳ này.
        </Hop>
      )}

      {(phieu ?? []).length > 0 && (
        <Card className="no-print">
          <CardHead
            title="Phiếu thu"
            sub="Chứng từ cho từng lần tiền về — mở ra để in hoặc lưu PDF"
          />
          <div className="divide-y divide-line">
            {(phieu ?? []).map((f) => (
              <Link
                key={f.id}
                href={`/phieu-thu/${f.id}`}
                className={cx(
                  'flex items-center justify-between gap-3 px-4 py-3 hover:bg-sunken',
                  f.huy_luc && 'opacity-60',
                )}
              >
                <div>
                  <div className="num text-sm font-medium text-ink">{f.so_phieu}</div>
                  <div className="mt-0.5 text-[0.75rem] text-faint">
                    {ngayVN(String(f.nhan_luc).slice(0, 10))}
                    {f.huy_luc && ' · đã hủy, tiền vẫn được ghi nhận'}
                  </div>
                </div>
                <span className="num text-sm font-medium text-ink">{vnd(f.tong_thu)}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {conLai <= 0 && (phieu ?? []).length === 0 && (
        <Hop className="no-print" tone="canh" title="Đã trả đủ nhưng chưa có phiếu thu">
          Khoản tiền được ghi nhận trước khi hệ thống bắt đầu cấp số chứng từ,
          hoặc BQL gạch tay ở nơi khác. Cần biên nhận thì báo BQL cấp bù.
        </Hop>
      )}

      {conLai > 0 && !bank && (
        <Hop className="no-print" tone="canh" title="Chưa cấu hình tài khoản nhận tiền">
          Vì thế chưa có mã QR. Liên hệ BQL để lấy thông tin chuyển khoản.
        </Hop>
      )}

      {qrError && (
        <Hop className="no-print" tone="xau" title="Không tạo được mã QR">{qrError}</Hop>
      )}
    </div>
  )
}
