import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

// Nhóm tuổi nợ. Mốc 90 ngày là ngưỡng BQL thường phải đưa ra ban quản trị,
// nên nó tách riêng chứ không gộp vào "quá hạn".
const NHOM = [
  { key: 'chua_han', nhan: 'Chưa tới hạn', hop: (d: number) => d < 0 },
  { key: 'd0_30',    nhan: 'Quá hạn ≤ 30 ngày', hop: (d: number) => d >= 0 && d <= 30 },
  { key: 'd31_90',   nhan: 'Quá hạn 31–90 ngày', hop: (d: number) => d > 30 && d <= 90 },
  { key: 'd90',      nhan: 'Quá hạn > 90 ngày', hop: (d: number) => d > 90 },
] as const

export default async function CongNo({
  searchParams,
}: { searchParams: Promise<{ nhom?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <main><p>Chưa có dự án nào.</p></main>
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const { data: rows, error } = await supabase.rpc('bql_debt_report', { p_project: project.id })

  // Không nuốt lỗi: bảng trống vì lỗi truy vấn trông y hệt bảng trống vì hết nợ,
  // mà hai chuyện đó ngược hẳn nhau.
  if (error) {
    return (
      <main className="space-y-3">
        <h1 className="text-2xl font-semibold">Công nợ</h1>
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm">
          Không tải được báo cáo: {error.message}
        </p>
      </main>
    )
  }

  const all = rows ?? []
  const nhomHienTai = NHOM.find((n) => n.key === sp.nhom)
  const hienThi = nhomHienTai ? all.filter((r) => nhomHienTai.hop(r.so_ngay_qua_han)) : all

  const tongNo = all.reduce((s, r) => s + r.con_no, 0)
  const quaHan = all.filter((r) => r.so_ngay_qua_han >= 0)
  const tongQuaHan = quaHan.reduce((s, r) => s + r.con_no, 0)

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Công nợ</h1>
        <Link href="/bql" className="text-sm underline">Quản lý tòa</Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Tổng phải thu</div>
          <div className="text-lg font-semibold">{vnd(tongNo)}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Trong đó quá hạn</div>
          <div className="text-lg font-semibold">{vnd(tongQuaHan)}</div>
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
          href="/bql/cong-no"
          className={`rounded border px-3 py-1 ${!nhomHienTai ? 'bg-black text-white' : ''}`}
        >
          Tất cả ({all.length})
        </Link>
        {NHOM.map((n) => {
          const soCan = all.filter((r) => n.hop(r.so_ngay_qua_han)).length
          return (
            <Link
              key={n.key}
              href={`/bql/cong-no?nhom=${n.key}`}
              className={`rounded border px-3 py-1 ${nhomHienTai?.key === n.key ? 'bg-black text-white' : ''}`}
            >
              {n.nhan} ({soCan})
            </Link>
          )
        })}
      </nav>

      {!hienThi.length ? (
        <p className="text-sm opacity-70">
          {all.length ? 'Không có căn nào trong nhóm này.' : 'Không có công nợ nào. Đã thu đủ.'}
        </p>
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
                    {new Date(r.han_cu_nhat).toLocaleDateString('vi-VN')}
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
    </main>
  )
}
