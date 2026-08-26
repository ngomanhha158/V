import { createClient } from '@/lib/supabase/server'
import { requestJoin } from './actions'

export const dynamic = 'force-dynamic'

export default async function Onboarding() {
  const supabase = await createClient()
  const { data: units } = await supabase
    .from('units')
    .select('id, code, floor_no, buildings(name)')
    .order('code')

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Xin gia nhập căn hộ</h1>
      <p className="text-sm opacity-70">
        Yêu cầu sẽ gửi tới chủ hộ. Được duyệt thì bạn mới thấy dữ liệu căn hộ.
      </p>

      <form action={requestJoin} className="space-y-3">
        <select name="unit_id" required className="w-full rounded border p-3">
          <option value="">— Chọn căn hộ —</option>
          {units?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} · {(u.buildings as any)?.name}
            </option>
          ))}
        </select>

        <select name="role" required className="w-full rounded border p-3">
          <option value="">— Vai trò —</option>
          <option value="owner">Chủ sở hữu</option>
          <option value="tenant">Người thuê</option>
          <option value="family">Thành viên gia đình</option>
          <option value="authorized">Người được ủy quyền</option>
        </select>

        <button className="w-full rounded bg-neutral-900 p-3 text-white">Gửi yêu cầu</button>
      </form>
    </main>
  )
}
