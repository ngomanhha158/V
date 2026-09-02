import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { BuildingForm } from './building-form'
import { Card, CardHead, Hop, PageHead, Stat, Trong } from '@/components/ui'
import { IcToaNha } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function Bql() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <main><p>Chưa có dự án nào trong hệ thống.</p></main>

  // Guard hiển thị. Chốt chặn thật là RLS.
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  // Hai truy vấn thường thay vì aggregate embed units(count): embed đó phụ thuộc
  // db-aggregates của PostgREST, tắt là query trả lỗi và trang hiện "chưa có
  // tòa nào" — sai sự thật mà không ai biết.
  const [{ data: buildings, error }, { data: units }] = await Promise.all([
    db.from('buildings').select('id, code, name, floor_count').order('code'),
    db.from('units').select('building_id'),
  ])
  const unitCount = new Map<string, number>()
  for (const u of units ?? []) unitCount.set(u.building_id, (unitCount.get(u.building_id) ?? 0) + 1)

  const tongCan = units?.length ?? 0

  return (
    <div className="space-y-5">
      <PageHead title="Quản lý tòa nhà" sub={project.name} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat nhan="Số tòa" so={buildings?.length ?? 0} />
        <Stat nhan="Tổng căn hộ" so={tongCan} />
        <Stat
          nhan="Trung bình mỗi tòa"
          so={buildings?.length ? Math.round(tongCan / buildings.length) : 0}
          phu="căn"
        />
      </div>

      <Card>
        <CardHead title="Thêm tòa mới" sub="Tạo tòa trước, rồi mới import căn hộ vào" />
        <div className="p-4"><BuildingForm /></div>
      </Card>

      <Card>
        <CardHead
          title="Danh sách tòa"
          right={<span className="text-[0.8125rem] text-faint">{buildings?.length ?? 0}</span>}
        />
        {error ? (
          <div className="p-4">
            <Hop tone="xau" title="Không đọc được danh sách tòa">{error.message}</Hop>
          </div>
        ) : !buildings?.length ? (
          <div className="p-4">
            <Trong title="Chưa có tòa nào">
              Tạo tòa ở khối bên trên trước khi import danh sách căn hộ.
            </Trong>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {buildings.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-faint">
                  <IcToaNha />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink">{b.code} · {b.name}</div>
                  <div className="text-[0.8125rem] text-muted">
                    {b.floor_count ? `${b.floor_count} tầng · ` : ''}
                    {unitCount.get(b.id) ?? 0} căn hộ
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
