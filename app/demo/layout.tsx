import Link from 'next/link'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
        <b>BẢN DEMO — dữ liệu giả.</b> Màn này bỏ qua đăng nhập và không kết nối
        database. Mọi tên người, số điện thoại và số tiền ở đây đều là bịa, dùng
        để xem giao diện. Bản chạy thật nằm ở{' '}
        <Link href="/" className="underline">trang chính</Link>.
      </div>

      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="opacity-60">Cư dân:</span>
        <Link href="/demo" className="underline">Trang chủ</Link>
        <Link href="/demo/invoices" className="underline">Hóa đơn</Link>
        <Link href="/demo/tickets" className="underline">Yêu cầu</Link>
        <span className="opacity-60">· BQL:</span>
        <Link href="/demo/bql" className="underline">Tổng quan</Link>
        <Link href="/demo/bql/cong-no" className="underline">Công nợ</Link>
        <Link href="/demo/bql/billing" className="underline">Hóa đơn</Link>
        <Link href="/demo/bql/tickets" className="underline">Điều phối</Link>
      </nav>

      {children}
    </div>
  )
}
