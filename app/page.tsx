import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // RLS lo phần lọc: chỉ trả về căn hộ user thực sự có quyền.
  const { data: memberships } = await supabase
    .from('unit_memberships')
    .select('id, role, status, valid_to, units(id, code, floor_no, buildings(name))')
    .eq('user_id', user?.id ?? '')

  // Chỉ để hiện/ẩn link. RLS mới là chốt chặn thật cho trang BQL.
  const { data: project } = await supabase.from('projects').select('id').limit(1).maybeSingle()
  const { data: isStaff } = project
    ? await supabase.rpc('is_staff', { p_project: project.id })
    : { data: false }

  const active = memberships?.filter((m) => m.status === 'active') ?? []
  const pending = memberships?.filter((m) => m.status === 'pending') ?? []

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">VBuilding</h1>

      {active.length === 0 && pending.length === 0 && (
        <p>
          Chưa gắn với căn hộ nào.{' '}
          <Link href="/onboarding" className="underline">Xin gia nhập căn hộ</Link>
        </p>
      )}

      {pending.length > 0 && (
        <p className="rounded bg-amber-100 p-3 text-amber-900">
          Đang chờ chủ hộ duyệt {pending.length} yêu cầu.
        </p>
      )}

      <ul className="space-y-2">
        {active.map((m) => (
          <li key={m.id} className="rounded border p-3">
            {m.units?.id ? (
              <Link href={`/unit/${m.units.id}`} className="font-medium underline">
                {m.units.code}
              </Link>
            ) : (
              <div className="font-medium">{m.units?.code}</div>
            )}
            <div className="text-sm opacity-70">
              {m.units?.buildings?.name} · vai trò: {m.role}
              {m.valid_to && ` · đến ${m.valid_to}`}
            </div>
          </li>
        ))}
      </ul>

      <nav className="flex gap-4 text-sm underline">
        <Link href="/onboarding">Thêm căn hộ</Link>
        <Link href="/tickets">Yêu cầu / sự cố</Link>
        <Link href="/approvals">Duyệt thành viên</Link>
        {isStaff && <Link href="/bql">Quản lý tòa nhà (BQL)</Link>}
      </nav>
    </main>
  )
}
