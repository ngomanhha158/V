import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { removeVehicle, removePet, updateMember } from './actions'
import { AddVehicleForm, AddPetForm } from './forms'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Chủ sở hữu', authorized: 'Người được ủy quyền',
  tenant: 'Người thuê', family: 'Thành viên gia đình',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt', active: 'Đang hoạt động', revoked: 'Đã thu hồi', expired: 'Hết hạn',
}

export default async function UnitProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // RLS trên units cho đọc; không thấy = không tồn tại với người này.
  const { data: unit } = await supabase
    .from('units')
    .select('id, code, floor_no, area_m2, kind, state, buildings(name, code)')
    .eq('id', id)
    .maybeSingle()
  if (!unit) notFound()

  const [{ data: isManager }, { data: members }, { data: vehicles }, { data: pets }] = await Promise.all([
    supabase.rpc('is_unit_manager', { p_unit: id }),
    supabase
      .from('unit_memberships')
      .select('id, role, status, valid_from, valid_to, profiles!unit_memberships_user_id_fkey(full_name, phone)')
      .eq('unit_id', id)
      .order('role'),
    supabase.from('unit_vehicles').select('id, plate, vehicle_type, card_no').eq('unit_id', id).order('plate'),
    supabase.from('unit_pets').select('id, name, species, vaccinated_until').eq('unit_id', id).order('name'),
  ])

  return (
    <main className="space-y-6">
      <div>
        <Link href="/" className="text-sm underline">← Trang chủ</Link>
        <h1 className="text-2xl font-semibold">{unit.code}</h1>
        <p className="text-sm opacity-70">
          {unit.buildings?.name} · tầng {unit.floor_no}
          {unit.area_m2 && ` · ${unit.area_m2} m²`}
        </p>
      </div>

      {!isManager && (
        <p className="rounded bg-neutral-100 p-3 text-sm">
          Bạn đang xem ở chế độ chỉ đọc. Chỉ chủ hộ và người được ủy quyền mới sửa được hồ sơ căn hộ.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-medium">Thành viên</h2>
        <ul className="space-y-2">
          {members?.map((m) => (
            <li key={m.id} className="rounded border p-3">
              <div className="font-medium">{m.profiles?.full_name ?? '(chưa có tên)'}</div>
              <div className="text-sm opacity-70">
                {m.profiles?.phone} · {ROLE_LABEL[m.role] ?? m.role} · {STATUS_LABEL[m.status] ?? m.status}
                {m.valid_to && ` · đến ${m.valid_to}`}
              </div>

              {isManager && m.status === 'active' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <form action={updateMember.bind(null, id)} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="action" value="valid_to" />
                    <input type="date" name="valid_to" defaultValue={m.valid_to ?? ''} className="rounded border p-1 text-sm" />
                    <button className="rounded border px-2 py-1 text-sm">Đặt hạn</button>
                  </form>
                  <form action={updateMember.bind(null, id)}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="action" value="revoke" />
                    <button className="rounded border px-2 py-1 text-sm text-red-700">Thu hồi</button>
                  </form>
                </div>
              )}
            </li>
          ))}
          {!members?.length && <li className="text-sm opacity-70">Chưa có thành viên nào.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Xe</h2>
        {isManager && <AddVehicleForm unitId={id} />}
        <ul className="space-y-2">
          {vehicles?.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded border p-3">
              <span>
                <b>{v.plate}</b>
                <span className="text-sm opacity-70">
                  {v.vehicle_type && ` · ${v.vehicle_type}`}{v.card_no && ` · thẻ ${v.card_no}`}
                </span>
              </span>
              {isManager && (
                <form action={removeVehicle.bind(null, id)}>
                  <input type="hidden" name="id" value={v.id} />
                  <button className="text-sm text-red-700 underline">Xóa</button>
                </form>
              )}
            </li>
          ))}
          {!vehicles?.length && <li className="text-sm opacity-70">Chưa đăng ký xe nào.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Thú cưng</h2>
        {isManager && <AddPetForm unitId={id} />}
        <ul className="space-y-2">
          {pets?.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded border p-3">
              <span>
                <b>{p.name}</b>
                <span className="text-sm opacity-70">
                  {p.species && ` · ${p.species}`}
                  {p.vaccinated_until && ` · tiêm phòng đến ${p.vaccinated_until}`}
                </span>
              </span>
              {isManager && (
                <form action={removePet.bind(null, id)}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-sm text-red-700 underline">Xóa</button>
                </form>
              )}
            </li>
          ))}
          {!pets?.length && <li className="text-sm opacity-70">Chưa đăng ký thú cưng nào.</li>}
        </ul>
      </section>
    </main>
  )
}
