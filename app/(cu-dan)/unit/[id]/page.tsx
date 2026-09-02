import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { removeVehicle, removePet, updateMember } from './actions'
import { AddVehicleForm, AddPetForm } from './forms'
import { Button, Card, CardHead, Hop, Input, PageHead, Pill, Trong, ngayVN } from '@/components/ui'
import { IcTrai } from '@/components/icons'

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
  const db = await createClient()

  // RLS trên units cho đọc; không thấy = không tồn tại với người này.
  const { data: unit } = await db
    .from('units')
    .select('id, code, floor_no, area_m2, kind, state, buildings(name, code)')
    .eq('id', id)
    .maybeSingle()
  if (!unit) notFound()

  const [{ data: isManager }, { data: members }, { data: vehicles }, { data: pets }] = await Promise.all([
    db.rpc('is_unit_manager', { p_unit: id }),
    db
      .from('unit_memberships')
      .select('id, role, status, valid_from, valid_to, profiles!unit_memberships_user_id_fkey(full_name, phone)')
      .eq('unit_id', id)
      .order('role'),
    db.from('unit_vehicles').select('id, plate, vehicle_type, card_no').eq('unit_id', id).order('plate'),
    db.from('unit_pets').select('id, name, species, vaccinated_until').eq('unit_id', id).order('name'),
  ])

  const TT: Record<string, 'trung' | 'tot' | 'canh' | 'xau'> = {
    pending: 'canh', active: 'tot', revoked: 'xau', expired: 'trung',
  }

  return (
    <div className="space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
      >
        <IcTrai width={16} height={16} /> Trang chủ
      </Link>

      <PageHead
        title={unit.code}
        sub={
          `${unit.buildings?.name} · tầng ${unit.floor_no}` +
          (unit.area_m2 ? ` · ${unit.area_m2} m²` : '')
        }
      />

      {!isManager && (
        <Hop tone="trung" title="Chế độ chỉ đọc">
          Chỉ chủ hộ và người được ủy quyền mới sửa được hồ sơ căn hộ.
        </Hop>
      )}

      <Card>
        <CardHead
          title="Thành viên"
          right={<span className="text-[0.8125rem] text-faint">{members?.length ?? 0}</span>}
        />
        {!members?.length ? (
          <div className="p-4"><Trong title="Chưa có thành viên nào" /></div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">
                      {m.profiles?.full_name ?? '(chưa có tên)'}
                    </div>
                    <div className="num mt-0.5 text-[0.8125rem] text-muted">
                      {m.profiles?.phone ?? '—'}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Pill tone="trung" cham={false}>{ROLE_LABEL[m.role] ?? m.role}</Pill>
                      <Pill tone={TT[m.status] ?? 'trung'}>
                        {STATUS_LABEL[m.status] ?? m.status}
                      </Pill>
                      {m.valid_to && (
                        <span className="num text-[0.75rem] text-faint">
                          đến {ngayVN(String(m.valid_to))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isManager && m.status === 'active' && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <form action={updateMember.bind(null, id)} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="action" value="valid_to" />
                      <Input
                        type="date" name="valid_to" defaultValue={m.valid_to ?? ''}
                        className="h-8 w-40 text-[0.8125rem]"
                      />
                      <Button co="sm">Đặt hạn</Button>
                    </form>
                    <form action={updateMember.bind(null, id)}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="action" value="revoke" />
                      <Button co="sm" dang="nguy">Thu hồi</Button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHead
          title="Xe đăng ký"
          sub="BQL đọc được để đối chiếu đỗ xe sai, nhưng không sửa hộ"
          right={<span className="text-[0.8125rem] text-faint">{vehicles?.length ?? 0}</span>}
        />
        {isManager && <div className="border-b border-line p-4"><AddVehicleForm unitId={id} /></div>}
        {!vehicles?.length ? (
          <div className="p-4"><Trong title="Chưa đăng ký xe nào" /></div>
        ) : (
          <ul className="divide-y divide-line">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <span className="num font-semibold text-ink">{v.plate}</span>
                  <span className="ml-2 text-[0.8125rem] text-muted">
                    {v.vehicle_type}
                    {v.card_no && ` · thẻ ${v.card_no}`}
                  </span>
                </div>
                {isManager && (
                  <form action={removeVehicle.bind(null, id)}>
                    <input type="hidden" name="id" value={v.id} />
                    <Button co="sm" dang="nguy">Xóa</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHead
          title="Thú cưng"
          right={<span className="text-[0.8125rem] text-faint">{pets?.length ?? 0}</span>}
        />
        {isManager && <div className="border-b border-line p-4"><AddPetForm unitId={id} /></div>}
        {!pets?.length ? (
          <div className="p-4"><Trong title="Chưa đăng ký thú cưng nào" /></div>
        ) : (
          <ul className="divide-y divide-line">
            {pets.map((p) => {
              const hetTiem = p.vaccinated_until
                && String(p.vaccinated_until) < new Date().toISOString().slice(0, 10)
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-ink">{p.name}</span>
                    {p.species && <span className="ml-2 text-[0.8125rem] text-muted">{p.species}</span>}
                    {p.vaccinated_until && (
                      <div className="mt-1">
                        <Pill tone={hetTiem ? 'xau' : 'tot'}>
                          {hetTiem ? 'Hết hạn tiêm phòng' : 'Tiêm phòng'} {ngayVN(String(p.vaccinated_until))}
                        </Pill>
                      </div>
                    )}
                  </div>
                  {isManager && (
                    <form action={removePet.bind(null, id)}>
                      <input type="hidden" name="id" value={p.id} />
                      <Button co="sm" dang="nguy">Xóa</Button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
