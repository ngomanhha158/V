import Link from 'next/link'
import { YEU_CAU } from '@/lib/demo/data'

// Ngày tháng trong dữ liệu demo tính tương đối theo hôm nay, nên không được
// prerender lúc build — để static thì vài tuần sau các mốc 'quá hạn' lệch hết.
export const dynamic = 'force-dynamic'

const TRANG_THAI: Record<string, string> = {
  new: 'Mới', assigned: 'Đã phân công', in_progress: 'Đang xử lý',
  resolved: 'Đã xong', closed: 'Đã đóng',
}
const UU_TIEN: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}

export default function DemoTickets() {
  return (
    <main className="mx-auto w-full max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Yêu cầu của tôi</h1>
        <span className="rounded bg-neutral-900 px-4 py-2 text-sm text-white opacity-50">
          Báo sự cố
        </span>
      </div>

      <ul className="space-y-2">
        {YEU_CAU.map((y) => {
          const quaHan = !y.xong_luc && new Date(y.han_xu_ly) < new Date()
          return (
            <li key={y.id} className="rounded border p-3">
              <Link href={`/demo/tickets/${y.id}`} className="font-medium underline">
                {y.tieu_de}
              </Link>
              <div className="text-sm opacity-70">
                {y.can} · {y.loai} · {UU_TIEN[y.uu_tien]} · {TRANG_THAI[y.trang_thai]}
              </div>
              {quaHan && <div className="mt-1 text-sm text-red-700">Quá hạn xử lý</div>}
              {y.danh_gia && (
                <div className="mt-1 text-sm">{'★'.repeat(y.danh_gia)}<span className="opacity-40">{'★'.repeat(5 - y.danh_gia)}</span></div>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
