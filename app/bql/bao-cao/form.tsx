'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Select } from '@/components/ui'
import { LA_MA, quyTruoc } from '@/lib/bao-cao'
import { huyBaoCao, lapBaoCao, type BCState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies BCState

/** Bốn quý ĐÃ KẾT THÚC gần nhất — quý đang chạy không lập báo cáo được. */
function cacQuy() {
  const d = new Date()
  let nam = d.getUTCFullYear()
  let quy = Math.floor(d.getUTCMonth() / 3) + 1
  const ra: { nam: number; quy: number }[] = []
  for (let i = 0; i < 4; i++) {
    const t = quyTruoc(nam, quy)
    nam = t.nam; quy = t.quy
    ra.push({ nam, quy })
  }
  return ra
}

export function FormLap({ project }: { project: string }) {
  const [state, action, dangChay] = useActionState(lapBaoCao, dauTien)
  const quy = cacQuy()
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="project" value={project} />
      <Field
        label="Quý"
        hint="Chỉ liệt kê quý ĐÃ KẾT THÚC — nửa quý đặt cạnh một quý đủ là phép so sánh sai mà nhìn rất hợp lý."
        className="min-w-[12rem]"
      >
        <Select name="ky" defaultValue={`${quy[0].nam}-${quy[0].quy}`}>
          {quy.map((q) => (
            <option key={`${q.nam}-${q.quy}`} value={`${q.nam}-${q.quy}`}>
              Quý {LA_MA[q.quy]}/{q.nam}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" dang="chinh" disabled={dangChay}>
        {dangChay ? 'Đang lập…' : 'Lập báo cáo'}
      </Button>
      {state.error && <Hop tone="xau" className="w-full">{state.error}</Hop>}
      {state.ok && <Hop tone="tot" className="w-full">{state.ok}</Hop>}
    </form>
  )
}

export function NutHuy({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(huyBaoCao, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <span className="text-[0.75rem] text-muted">{state.ok}</span>
  if (!mo) return <Button type="button" co="sm" onClick={() => setMo(true)}>Hủy bản này</Button>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Input name="ly_do" autoFocus placeholder="Vì sao hủy báo cáo này?" className="min-w-[15rem]" />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
          {dangChay ? 'Đang hủy…' : 'Xác nhận hủy'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}
