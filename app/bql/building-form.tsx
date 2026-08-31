'use client'
import { useActionState } from 'react'
import { addBuilding, type BuildingState } from './actions'
import { Button, Field, Hop, Input } from '@/components/ui'
import { IcThem } from '@/components/icons'

export function BuildingForm() {
  const [state, action, busy] = useActionState(addBuilding, {} as BuildingState)
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[7rem_1fr_7rem]">
        <Field label="Mã tòa"><Input name="code" placeholder="P1" required /></Field>
        <Field label="Tên tòa"><Input name="name" placeholder="Park 1" required /></Field>
        <Field label="Số tầng">
          <Input name="floor_count" placeholder="25" inputMode="numeric" className="num" />
        </Field>
      </div>
      {state.error && <Hop tone="xau" title="Không thêm được">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" dang="chinh" disabled={busy}>
        <IcThem width={15} height={15} />
        {busy ? 'Đang lưu…' : 'Thêm tòa'}
      </Button>
    </form>
  )
}
