import Link from 'next/link'
import { CAN_CUA_TOI, HOA_DON, TOI, YEU_CAU, DU_AN } from '@/lib/demo/data'

// Ngày tháng trong dữ liệu demo tính tương đối theo hôm nay, nên không được
// prerender lúc build — để static thì vài tuần sau các mốc 'quá hạn' lệch hết.
export const dynamic = 'force-dynamic'

const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export default function DemoHome() {
  const conNo = HOA_DON.reduce((s, h) => s + (h.tong - h.da_tra), 0)
  const dangMo = YEU_CAU.filter((y) => y.trang_thai !== 'closed' && y.trang_thai !== 'resolved')

  return (
    <main className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">VBuilding</h1>
        <p className="text-sm opacity-70">{DU_AN.ten} · xin chào {TOI.ho_ten}</p>
      </div>

      {conNo > 0 && (
        <Link
          href="/demo/invoices"
          className="block rounded border border-red-300 bg-red-50 p-3 text-red-900"
        >
          Còn nợ <b>{vnd(conNo)}</b> — xem hóa đơn →
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="font-medium">Căn hộ của tôi</h2>
        <ul className="space-y-2">
          {CAN_CUA_TOI.map((c) => (
            <li key={c.id} className="rounded border p-3">
              <div className="font-medium">{c.code}</div>
              <div className="text-sm opacity-70">
                {c.toa} · tầng {c.tang} · {c.dien_tich} m² · vai trò: {c.vai_tro}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {dangMo.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Yêu cầu đang xử lý</h2>
          <ul className="space-y-2">
            {dangMo.map((y) => (
              <li key={y.id} className="rounded border p-3">
                <Link href={`/demo/tickets/${y.id}`} className="font-medium underline">
                  {y.tieu_de}
                </Link>
                <div className="text-sm opacity-70">{y.can} · {y.nguoi_xu_ly ?? 'chưa phân công'}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex gap-4 text-sm underline">
        <Link href="/demo/tickets">Yêu cầu / sự cố</Link>
        <Link href="/demo/invoices">Hóa đơn</Link>
        <Link href="/demo/bql">Quản lý tòa nhà (BQL)</Link>
      </nav>
    </main>
  )
}
