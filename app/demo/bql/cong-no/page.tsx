import Link from 'next/link'
import { CONG_NO } from '@/lib/demo/data'

const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

const NHOM = [
  { key: 'chua_han', nhan: 'Chưa tới hạn', hop: (d: number) => d < 0 },
  { key: 'd0_30', nhan: 'Quá hạn ≤ 30 ngày', hop: (d: number) => d >= 0 && d <= 30 },
  { key: 'd31_90', nhan: 'Quá hạn 31–90 ngày', hop: (d: number) => d > 30 && d <= 90 },
  { key: 'd90', nhan: 'Quá hạn > 90 ngày', hop: (d: number) => d > 90 },
] as const

export default async function DemoCongNo({
  searchParams,
}: { searchParams: Promise<{ nhom?: string }> }) {
  const sp = await searchParams
  const all = CONG_NO
  const nhomHienTai = NHOM.find((n) => n.key === sp.nhom)
  const hienThi = nhomHienTai ? all.filter((r) => nhomHienTai.hop(r.so_ngay_qua_han)) : all

  const tongNo = all.reduce((s, r) => s + r.con_no, 0)
  const quaHan = all.filter((r) => r.so_ngay_qua_han >= 0)

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Công nợ</h1>
        <Link href="/demo/bql" className="text-sm underline">Quản lý tòa</Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Tổng phải thu</div>
          <div className="text-lg font-semibold">{vnd(tongNo)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Trong đó quá hạn</div>
          <div className="text-lg font-semibold">
            {vnd(quaHan.reduce((s, r) => s + r.con_no, 0))}
          </div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Số căn còn nợ</div>
          <div className="text-lg font-semibold">
            {all.length} <span className="text-sm font-normal opacity-70">({quaHan.length} quá hạn)</span>
          </div>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/demo/bql/cong-no"
          className={`rounded border px-3 py-1 ${!nhomHienTai ? 'bg-black text-white' : ''}`}
        >
          Tất cả ({all.length})
        </Link>
        {NHOM.map((n) => (
          <Link
            key={n.key}
            href={`/demo/bql/cong-no?nhom=${n.key}`}
            className={`rounded border px-3 py-1 ${nhomHienTai?.key === n.key ? 'bg-black text-white' : ''}`}
          >
            {n.nhan} ({all.filter((r) => n.hop(r.so_ngay_qua_han)).length})
          </Link>
        ))}
      </nav>

      {!hienThi.length ? (
        <p className="text-sm opacity-70">Không có căn nào trong nhóm này.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Căn</th>
                <th className="p-2">Người liên hệ</th>
                <th className="p-2 text-right">Số HĐ</th>
                <th className="p-2 text-right">Còn nợ</th>
                <th className="p-2 text-right">Hạn cũ nhất</th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map((r) => (
                <tr key={r.unit_id} className="border-b align-top">
                  <td className="p-2 font-medium">
                    {r.unit_code}
                    <div className="text-xs opacity-60">{r.building_code}</div>
                  </td>
                  <td className="p-2">
                    {r.ten_lien_he ?? <span className="opacity-60">Chưa có chủ hộ</span>}
                    {r.dien_thoai && (
                      <div className="text-xs">
                        <a href={`tel:${r.dien_thoai}`} className="underline">{r.dien_thoai}</a>
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums">{r.so_hoa_don}</td>
                  <td className="p-2 text-right font-medium tabular-nums">{vnd(r.con_no)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {r.han_cu_nhat}
                    <div className={`text-xs ${r.so_ngay_qua_han > 30 ? 'text-red-600' : 'opacity-60'}`}>
                      {r.so_ngay_qua_han < 0
                        ? `còn ${-r.so_ngay_qua_han} ngày`
                        : r.so_ngay_qua_han === 0
                          ? 'đến hạn hôm nay'
                          : `quá ${r.so_ngay_qua_han} ngày`}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="rounded border p-3 text-sm opacity-70">
        Cron nhắc nợ chạy 08:00 hằng ngày, bắn thông báo ở ba mốc: trước hạn 3
        ngày, đúng ngày đến hạn, và quá hạn 3 ngày. Chỉ người được xem công nợ
        mới nhận.
      </p>
    </main>
  )
}
