'use client'
import { useActionState } from 'react'
import { addVehicle, addPet, type FormState } from './actions'

const empty: FormState = {}

export function AddVehicleForm({ unitId }: { unitId: string }) {
  const [state, action, busy] = useActionState(addVehicle.bind(null, unitId), empty)
  return (
    <form action={action} className="space-y-2 rounded border p-3">
      <div className="flex flex-wrap gap-2">
        <input name="plate" placeholder="Biển số" required className="w-36 rounded border p-2" />
        <input name="vehicle_type" placeholder="Loại xe" className="w-32 rounded border p-2" />
        <input name="card_no" placeholder="Số thẻ" className="w-28 rounded border p-2" />
        <button disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          {busy ? '…' : 'Thêm xe'}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
    </form>
  )
}

export function AddPetForm({ unitId }: { unitId: string }) {
  const [state, action, busy] = useActionState(addPet.bind(null, unitId), empty)
  return (
    <form action={action} className="space-y-2 rounded border p-3">
      <div className="flex flex-wrap gap-2">
        <input name="name" placeholder="Tên" required className="w-32 rounded border p-2" />
        <input name="species" placeholder="Loài (chó/mèo)" className="w-36 rounded border p-2" />
        <label className="flex items-center gap-1 text-sm">
          Tiêm phòng đến
          <input type="date" name="vaccinated_until" className="rounded border p-2" />
        </label>
        <button disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          {busy ? '…' : 'Thêm'}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
    </form>
  )
}
