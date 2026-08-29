import Link from 'next/link'
import { HOA_DON_KY_NAY, ky } from '@/lib/demo/data'

// Ngày tháng trong dữ liệu demo tính tương đối theo hôm nay, nên không được
// prerender lúc build — để static thì vài tuần sau các mốc 'quá hạn' lệch hết.
export const dynamic = 'force-dynamic'

const NHAN: Record<string, string> = {
  draft: 'Nháp', issued: 'Đã phát hành', paid: 'Đã thu',
}
const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export default function DemoBilling() {
  const tong = HOA_DON_KY_NAY.reduce((s, h) => s + h.tong, 0)
  const nhap = HOA_DON_KY_NAY.filter((h) => h.trang_thai === 'draft').length

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hóa đơn</h1>
        <div className="flex gap-3 text-sm underline">
          <Link href="/demo/bql/cong-no">Công nợ</Link>
          <Link href="/demo/bql">Quản lý tòa</Link>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label>Kỳ</label>
        <input type="month" defaultValue={ky(0).slice(0, 7)} className="rounded border p-2" disabled />
      </div>

      <section className="rounded border p-3 text-sm">
        <b>{HOA_DON_KY_NAY.length}</b> hóa đơn · <b>{nhap}</b> còn nháp · tổng <b>{vnd(tong)}</b>
      </section>

      <section className="space-y-2 rounded border p-3">
        <h2 className="font-medium">Nhập chỉ số công tơ</h2>
        <p className="text-sm opacity-70">
          BQL nhập chỉ số đầu/cuối kỳ cho từng căn. Căn nào chưa có chỉ số thì
          hóa đơn không sinh dòng điện 0đ — đó là một trong các bất biến được
          test khóa lại.
        </p>
        <div className="grid grid-cols-3 gap-2 text-sm opacity-50">
          <div className="rounded border p-2">P1-10.01 · 1250 → 1400</div>
          <div className="rounded border p-2">P1-10.02 · 980 → 1086</div>
          <div className="rounded border p-2">P2-03.01 · — → —</div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <span className="rounded bg-neutral-900 px-4 py-2 text-sm text-white opacity-50">
          Sinh hóa đơn kỳ này
        </span>
        <span className="rounded border px-4 py-2 text-sm opacity-50">
          Phát hành {nhap} hóa đơn nháp
        </span>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Danh sách hóa đơn kỳ {ky(0).slice(0, 7)}</h2>
        <ul className="space-y-1">
          {HOA_DON_KY_NAY.map((h) => (
            <li key={h.can} className="flex justify-between rounded border p-2 text-sm">
              <span>{h.can}</span>
              <span>{vnd(h.tong)} · {NHAN[h.trang_thai]}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
