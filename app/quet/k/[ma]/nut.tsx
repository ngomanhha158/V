'use client'

import { useActionState } from 'react'
import { Button, Hop } from '@/components/ui'
import { ghiSo, type GhiSoState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies GhiSoState

export function NutGhiSo({ ma, daVao, hoTen }: { ma: string; daVao: boolean; hoTen: string }) {
  const [state, action, dangChay] = useActionState(ghiSo, dauTien)

  if (state.ok) return <Hop tone="tot" title="Đã ghi vào sổ">{state.ok}</Hop>

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ma" value={ma} />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {/* Nút to và nói rõ nó sắp ghi GÌ. "Xác nhận" thì bảo vệ không biết mình
          đang ghi giờ vào hay giờ ra, mà hai cái đó là hai sự việc khác nhau. */}
      <Button type="submit" dang="chinh" disabled={dangChay} className="h-12 w-full text-[0.9375rem]">
        {dangChay
          ? 'Đang ghi…'
          : daVao
            ? `Ghi giờ RA cho ${hoTen}`
            : `Ghi giờ VÀO cho ${hoTen}`}
      </Button>
      <p className="text-[0.75rem] leading-relaxed text-faint">
        Mở trang này không ghi gì cả — soi thử thoải mái. Chỉ nút trên mới ghi vào sổ.
      </p>
    </form>
  )
}
