'use client'

import { useActionState } from 'react'
import { Button, Hop } from '@/components/ui'
import { datSuat, huySuat, type DatState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies DatState

export function NutDat({ suat, ngay, nhan }: { suat: string; ngay: string; nhan: string }) {
  const [state, action, dangChay] = useActionState(datSuat, dauTien)
  return (
    <form action={action}>
      <input type="hidden" name="suat" value={suat} />
      <input type="hidden" name="ngay" value={ngay} />
      {state.error && <Hop tone="xau" className="mb-2">{state.error}</Hop>}
      {state.ok && <Hop tone="tot" className="mb-2">{state.ok}</Hop>}
      {!state.ok && (
        <Button type="submit" co="sm" dang="chinh" disabled={dangChay}>
          {dangChay ? 'Đang giữ…' : `Đặt ${nhan}`}
        </Button>
      )}
    </form>
  )
}

export function NutHuy({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(huySuat, dauTien)
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state.error && <Hop tone="xau" className="mb-2">{state.error}</Hop>}
      {state.ok && <Hop tone="tot" className="mb-2">{state.ok}</Hop>}
      {!state.ok && (
        <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
          {dangChay ? 'Đang hủy…' : 'Hủy suất'}
        </Button>
      )}
    </form>
  )
}
