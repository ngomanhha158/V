import Link from 'next/link'
import { CONG_NO, DU_AN, HOA_DON_KY_NAY, YEU_CAU_TOAN_KHU } from '@/lib/demo/data'

// Ngày tháng trong dữ liệu demo tính tương đối theo hôm nay, nên không được
// prerender lúc build — để static thì vài tuần sau các mốc 'quá hạn' lệch hết.
export const dynamic = 'force-dynamic'

const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export default function DemoBql() {
  const tongNo = CONG_NO.reduce((s, r) => s + r.con_no, 0)
  const quaHan = CONG_NO.filter((r) => r.so_ngay_qua_han > 0)
  const chuaXong = YEU_CAU_TOAN_KHU.filter((y) => !y.xong_luc)
  const treSla = chuaXong.filter((y) => new Date(y.han_xu_ly) < new Date())
  const nhap = HOA_DON_KY_NAY.filter((h) => h.trang_thai === 'draft').length

  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Quản lý tòa nhà</h1>
        <p className="text-sm opacity-70">{DU_AN.ten}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Phải thu</div>
          <div className="text-lg font-semibold">{vnd(tongNo)}</div>
          <div className="text-xs opacity-60">{CONG_NO.length} căn</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Quá hạn</div>
          <div className="text-lg font-semibold text-red-700">{quaHan.length} căn</div>
          <div className="text-xs opacity-60">{vnd(quaHan.reduce((s, r) => s + r.con_no, 0))}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Yêu cầu đang mở</div>
          <div className="text-lg font-semibold">{chuaXong.length}</div>
          <div className="text-xs opacity-60">{treSla.length} trễ SLA</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Hóa đơn kỳ này</div>
          <div className="text-lg font-semibold">{HOA_DON_KY_NAY.length}</div>
          <div className="text-xs opacity-60">{nhap} còn nháp</div>
        </div>
      </section>

      {treSla.length > 0 && (
        <Link
          href="/demo/bql/tickets"
          className="block rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
        >
          <b>{treSla.length} yêu cầu đã trễ hạn SLA</b> — cron leo thang chạy 5 phút/lần, xem ngay →
        </Link>
      )}

      <nav className="flex flex-wrap gap-4 text-sm underline">
        <Link href="/demo/bql/cong-no">Công nợ →</Link>
        <Link href="/demo/bql/billing">Hóa đơn →</Link>
        <Link href="/demo/bql/tickets">Điều phối yêu cầu →</Link>
      </nav>
    </main>
  )
}
