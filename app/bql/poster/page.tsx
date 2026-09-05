import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { Card, CardHead, Hop, PageHead, Trong } from '@/components/ui'
import { PrintButton } from './print-button'

export const dynamic = 'force-dynamic'

/**
 * Poster QR dán sảnh và thang máy (N29).
 *
 * In từ trình duyệt chứ không sinh PDF: thêm một thư viện PDF vào bundle để
 * dùng đúng một lần mỗi khu là không đáng. Ctrl+P của trình duyệt ra PDF sẵn.
 */
export default async function Poster() {
  const db = await createClient()
  const project = await duAnBQL()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const h = await headers()
  const host = h.get('host') ?? 'localhost:3000'
  // x-forwarded-proto: sau proxy của Railway thì request tới máy chủ là http,
  // mà QR phải trỏ https — quét ra http là trình duyệt cảnh báo hoặc chặn.
  const scheme = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const url = `${scheme}://${host}/`

  const qr = await QRCode.toString(url, {
    type: 'svg', margin: 0, errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })

  return (
    <div className="space-y-5">
      <div className="no-print">
        <PageHead
          title="Poster QR"
          sub="In ra, dán sảnh và trong thang máy"
          actions={<PrintButton />}
        />
        <Hop tone="trung" title="Trước khi in" className="mt-4">
          Mã QR trỏ tới <code className="rounded bg-sunken px-1">{url}</code>. Nếu đây chưa phải
          tên miền thật của khu thì in ra sẽ dán một mã dẫn về máy chủ tạm — mở màn này trên
          đúng tên miền production rồi mới in.
          <br /><br />
          In khổ A4, chọn “Background graphics” nếu máy in hỏi, và bỏ header/footer của trình
          duyệt. Dán trong thang máy hiệu quả hơn sảnh: đó là chỗ người ta đứng chờ và rảnh tay.
        </Hop>
      </div>

      {/* Khung poster. Nền trắng chữ đen cố định, KHÔNG theo chế độ tối: nó đi
          ra máy in, không ở lại trên màn hình. */}
      <Card className="mx-auto w-full max-w-[210mm] overflow-hidden print:max-w-none print:border-0 print:shadow-none">
        <div className="no-print">
          <CardHead title="Bản in thử" sub="Đúng những gì sẽ ra giấy" />
        </div>
        <div className="bg-white px-10 py-12 text-center text-[#101828] print:px-6 print:py-8">
          <p className="text-[0.9375rem] font-semibold tracking-[0.2em] text-[#525f72] uppercase">
            Ban quản lý
          </p>
          <h1 className="mt-2 text-4xl leading-tight font-bold text-[#101828]">
            {project.name}
          </h1>
          <p className="mt-5 text-xl font-semibold text-[#2563eb]">
            Quét mã để dùng app cư dân
          </p>

          <div
            className="mx-auto mt-7 w-[62mm] [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />

          <p className="num mt-4 text-sm text-[#525f72]">{url}</p>

          <ol className="mx-auto mt-8 max-w-md space-y-3 text-left">
            {[
              ['Quét mã', 'Mở camera điện thoại và hướng vào ô vuông bên trên.'],
              ['Nhập email', 'Hệ thống gửi một mã đăng nhập. Không cần đặt mật khẩu.'],
              ['Chọn căn hộ của mình', 'Ban quản lý duyệt xong là bạn xem được hóa đơn, gửi yêu cầu sửa chữa, đọc nội quy.'],
            ].map(([tieuDe, mo], i) => (
              <li key={tieuDe} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eff5ff] text-sm font-bold text-[#1d4ed8]">
                  {i + 1}
                </span>
                <span className="text-[0.9375rem] leading-snug">
                  <strong className="text-[#101828]">{tieuDe}.</strong>{' '}
                  <span className="text-[#525f72]">{mo}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-9 border-t border-[#e7eaee] pt-5 text-[0.8125rem] text-[#7a8699]">
            Cần trợ giúp? Liên hệ quầy lễ tân ban quản lý.
          </p>
        </div>
      </Card>
    </div>
  )
}
