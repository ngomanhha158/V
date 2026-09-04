'use client'

import { useActionState } from 'react'
import { Button, Hop } from '@/components/ui'
import { nhanLoaiHoa } from '@/lib/kien-hang'
import { traoKien, type TraoState } from './actions-kien'

const dauTien = { error: undefined, ok: undefined } satisfies TraoState

export function NutTrao({
  id, uid, loai, moTa,
}: { id: string; uid: string; loai: string; moTa: string }) {
  const [state, action, dangChay] = useActionState(traoKien, dauTien)

  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>

  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-2 py-2">
      <input type="hidden" name="kien" value={id} />
      <input type="hidden" name="nguoi" value={uid} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{nhanLoaiHoa(loai)}</div>
        {moTa && <div className="text-[0.75rem] text-faint">{moTa}</div>}
      </div>
      {state.error
        ? <Hop tone="xau" className="w-full">{state.error}</Hop>
        : (
          <Button type="submit" co="sm" dang="chinh" disabled={dangChay}>
            {dangChay ? 'Đang trao…' : 'Trao kiện này'}
          </Button>
        )}
    </form>
  )
}
