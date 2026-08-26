import { createClient } from '@/lib/supabase/server'
import { decide } from './actions'

export const dynamic = 'force-dynamic'

export default async function Approvals() {
  const supabase = await createClient()
  const { data: pending } = await supabase
    .from('unit_memberships')
    // Phải chỉ đích danh FK: unit_memberships có 2 đường sang profiles
    // (user_id và approved_by). Để trống thì PostgREST không đoán được và query lỗi.
    .select('id, role, created_at, profiles!unit_memberships_user_id_fkey(full_name, phone), units(code)')
    .eq('status', 'pending')

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Yêu cầu chờ duyệt</h1>
      {!pending?.length && <p className="opacity-70">Không có yêu cầu nào.</p>}

      {pending?.map((m) => (
        <form key={m.id} action={decide} className="space-y-2 rounded border p-3">
          <input type="hidden" name="id" value={m.id} />
          <div className="font-medium">{m.profiles?.full_name}</div>
          <div className="text-sm opacity-70">
            {m.profiles?.phone} · xin vào {m.units?.code} · vai trò {m.role}
          </div>

          {/* Người thuê / ủy quyền phải có hạn, nếu không quyền không bao giờ tự thu hồi */}
          {(m.role === 'tenant' || m.role === 'authorized') && (
            <label className="block text-sm">
              Hết hạn
              <input type="date" name="valid_to" required className="ml-2 rounded border p-1" />
            </label>
          )}

          <div className="flex gap-2">
            <button name="approve" value="1" className="rounded bg-neutral-900 px-4 py-2 text-white">
              Duyệt
            </button>
            <button name="approve" value="0" className="rounded border px-4 py-2">
              Từ chối
            </button>
          </div>
        </form>
      ))}
    </main>
  )
}
