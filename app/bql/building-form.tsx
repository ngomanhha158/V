'use client'
import { useActionState } from 'react'
import { addBuilding, type BuildingState } from './actions'

export function BuildingForm() {
  const [state, action, busy] = useActionState(addBuilding, {} as BuildingState)
  return (
    <form action={action} className="space-y-3 rounded border p-4">
      <h2 className="font-medium">Thêm tòa</h2>
      <div className="flex gap-2">
        <input name="code" placeholder="Mã (P1)" required className="w-28 rounded border p-2" />
        <input name="name" placeholder="Tên tòa" required className="flex-1 rounded border p-2" />
        <input name="floor_count" placeholder="Số tầng" inputMode="numeric" className="w-24 rounded border p-2" />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
      <button disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? 'Đang lưu…' : 'Thêm tòa'}
      </button>
    </form>
  )
}
