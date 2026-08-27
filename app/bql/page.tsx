import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BuildingForm } from './building-form'

export const dynamic = 'force-dynamic'

export default async function Bql() {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <main><p>Chưa có dự án nào trong hệ thống.</p></main>

  // Guard hiển thị. Chốt chặn thật là RLS.
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  // Hai truy vấn thường thay vì aggregate embed units(count): embed đó phụ thuộc
  // db-aggregates của PostgREST, tắt là query trả lỗi và trang hiện "chưa có
  // tòa nào" — sai sự thật mà không ai biết.
  const [{ data: buildings, error }, { data: units }] = await Promise.all([
    supabase.from('buildings').select('id, code, name, floor_count').order('code'),
    supabase.from('units').select('building_id'),
  ])
  const unitCount = new Map<string, number>()
  for (const u of units ?? []) unitCount.set(u.building_id, (unitCount.get(u.building_id) ?? 0) + 1)

  return (
    <main className="space-y-5">
      <h1 className="text-2xl font-semibold">Quản lý tòa nhà</h1>
      <p className="text-sm opacity-70">{project.name}</p>

      <BuildingForm />

      <section className="space-y-2">
        <h2 className="font-medium">Danh sách tòa</h2>
        {error && (
          <p className="rounded bg-red-100 p-3 text-sm text-red-900">
            Không đọc được danh sách tòa: {error.message}
          </p>
        )}
        {!error && !buildings?.length && (
          <p className="text-sm opacity-70">Chưa có tòa nào. Tạo tòa trước khi import căn hộ.</p>
        )}
        <ul className="space-y-2">
          {buildings?.map((b) => (
            <li key={b.id} className="rounded border p-3">
              <div className="font-medium">{b.code} · {b.name}</div>
              <div className="text-sm opacity-70">
                {b.floor_count ? `${b.floor_count} tầng · ` : ''}
                {unitCount.get(b.id) ?? 0} căn hộ
              </div>
            </li>
          ))}
        </ul>
      </section>

      <nav className="flex flex-wrap gap-4 underline">
        <Link href="/bql/import">Import danh sách căn hộ từ Excel →</Link>
        <Link href="/bql/tickets">Điều phối yêu cầu →</Link>
        <Link href="/bql/billing">Hóa đơn →</Link>
      </nav>
    </main>
  )
}
