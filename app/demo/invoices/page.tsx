import Link from 'next/link'
import { HOA_DON } from '@/lib/demo/data'

// Ngày tháng trong dữ liệu demo tính tương đối theo hôm nay, nên không được
// prerender lúc build — để static thì vài tuần sau các mốc 'quá hạn' lệch hết.
export const dynamic = 'force-dynamic'

const NHAN: Record<string, string> = {
  issued: 'Chưa thanh toán', partial: 'Trả một phần', paid: 'Đã thanh toán',
}
const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export default function DemoInvoices() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Hóa đơn</h1>
      <ul className="space-y-2">
        {HOA_DON.map((h) => {
          const conLai = h.tong - h.da_tra
          const quaHan = conLai > 0 && new Date(h.han) < new Date()
          return (
            <li key={h.id} className="rounded border p-3">
              <Link href={`/demo/invoices/${h.id}`} className="font-medium underline">
                {h.can} · kỳ {h.ky.slice(0, 7)}
              </Link>
              <div className="text-sm opacity-70">
                {vnd(h.tong)} · {NHAN[h.trang_thai]}
                {conLai > 0 && ` · còn ${vnd(conLai)}`}
              </div>
              {quaHan && <div className="mt-1 text-sm text-red-700">Quá hạn {h.han}</div>}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
