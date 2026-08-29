import Link from 'next/link'
import { YEU_CAU_TOAN_KHU } from '@/lib/demo/data'

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

export default function DemoBqlTickets() {
  // Trễ SLA lên đầu, rồi tới khẩn cấp: màn điều phối phải bày ra việc đang cháy.
  const sap = [...YEU_CAU_TOAN_KHU].sort((a, b) => {
    const treA = !a.xong_luc && new Date(a.han_xu_ly) < new Date() ? 0 : 1
    const treB = !b.xong_luc && new Date(b.han_xu_ly) < new Date() ? 0 : 1
    return treA - treB
  })

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Điều phối yêu cầu</h1>
        <Link href="/demo/bql" className="text-sm underline">Quản lý tòa</Link>
      </div>

      <ul className="space-y-2">
        {sap.map((y) => {
          const treSla = !y.xong_luc && new Date(y.han_xu_ly) < new Date()
          return (
            <li
              key={y.id}
              className={`rounded border p-3 ${treSla ? 'border-red-300 bg-red-50' : ''}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{y.tieu_de}</span>
                <span className="text-sm opacity-70">
                  {y.can} · {y.nguoi_bao}
                </span>
              </div>
              <div className="mt-1 text-sm opacity-70">
                {y.loai} · {UU_TIEN[y.uu_tien]} · {TRANG_THAI[y.trang_thai]}
                {' · '}hạn {y.han_xu_ly}
              </div>
              {treSla && (
                <div className="mt-1 text-sm font-medium text-red-700">
                  Trễ SLA — cron leo thang đã đẩy lên trưởng BQL
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className="rounded border px-3 py-1 opacity-50">
                  {y.nguoi_xu_ly ? `Đổi người xử lý (${y.nguoi_xu_ly})` : 'Phân công'}
                </span>
                <span className="rounded border px-3 py-1 opacity-50">Đổi trạng thái</span>
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
