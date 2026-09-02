'use client'
import { useActionState } from 'react'
import { Button, Hop, Input, Select } from '@/components/ui'
import { LOAI_XE, NHAN_LOAI } from '@/lib/xe'
import { addVehicle, addPet, type FormState } from './actions'

const empty: FormState = {}

export function AddVehicleForm({ unitId }: { unitId: string }) {
  const [state, action, busy] = useActionState(addVehicle.bind(null, unitId), empty)
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input name="plate" placeholder="Biển số" required className="num w-36" />
        {/* Loại xe là Ô CHỌN chứ không phải ô gõ tự do: hạn mức đếm theo loại,
            mà "ô tô" / "oto" / "Ô Tô" gõ tay thì không đếm chung được. */}
        <Select name="loai" required defaultValue="" className="w-32">
          <option value="" disabled>Loại xe</option>
          {LOAI_XE.map((l) => <option key={l} value={l}>{NHAN_LOAI[l]}</option>)}
        </Select>
        <Input name="card_no" placeholder="Số thẻ" className="num w-28" />
        <Button type="submit" co="sm" dang="chinh" disabled={busy}>
          {busy ? 'Đang gửi…' : 'Đăng ký xe'}
        </Button>
      </div>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
    </form>
  )
}

export function AddPetForm({ unitId }: { unitId: string }) {
  const [state, action, busy] = useActionState(addPet.bind(null, unitId), empty)
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input name="name" placeholder="Tên" required className="w-32" />
        <Input name="species" placeholder="Loài (chó/mèo)" className="w-36" />
        <label className="flex items-center gap-2 text-[0.8125rem] text-muted">
          Tiêm phòng đến
          <Input type="date" name="vaccinated_until" className="num w-40" />
        </label>
        <Button type="submit" co="sm" dang="chinh" disabled={busy}>
          {busy ? 'Đang gửi…' : 'Thêm'}
        </Button>
      </div>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
    </form>
  )
}
