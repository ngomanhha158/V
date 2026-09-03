'use client'

import { useActionState, useState } from 'react'
import { Button, Hop, Input } from '@/components/ui'
import { huyPhieu, type PhieuThuState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies PhieuThuState

export function NutHuy({ id, soPhieu }: { id: string; soPhieu: string }) {
  const [state, action, dangChay] = useActionState(huyPhieu, dauTien)
  const [mo, setMo] = useState(false)

  if (!mo) {
    return (
      <>
        <Button type="button" co="sm" onClick={() => setMo(true)}>Hủy phiếu</Button>
        {state.ok && <Hop tone="tot" className="mt-2">{state.ok}</Hop>}
      </>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Input
        name="ly_do"
        placeholder={`Vì sao hủy ${soPhieu}?`}
        autoFocus
        className="min-w-[16rem]"
      />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
          {dangChay ? 'Đang hủy…' : 'Xác nhận hủy'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}
