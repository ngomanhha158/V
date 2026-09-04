'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Textarea } from '@/components/ui'
import { huyChot, kyChot, lapChot, type BanGiaoState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies BanGiaoState
const homQua = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

export function FormLap({ project }: { project: string }) {
  const [state, action, dangChay] = useActionState(lapChot, dauTien)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      <Field
        label="Ngày chốt"
        hint="Mốc bàn giao. Số liệu tính tới hết ngày này, không tính khoản về sau."
      >
        <Input type="date" name="ngay" required defaultValue={homQua()} max={homQua()} className="num" />
      </Field>
      <Field label="Ghi chú" hint="Không bắt buộc — ví dụ: bàn giao cho đơn vị mới">
        <Textarea name="ghi_chu" rows={2} />
      </Field>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang chốt…' : 'Chốt sổ'}
      </Button>
    </form>
  )
}

export function NutKy({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(kyChot, dauTien)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang ký…' : 'Ký bản chốt này'}
      </Button>
    </form>
  )
}

export function NutHuy({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(huyChot, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <span className="text-[0.75rem] text-muted">{state.ok}</span>
  if (!mo) return <Button type="button" co="sm" onClick={() => setMo(true)}>Hủy bản chốt</Button>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Input name="ly_do" autoFocus placeholder="Vì sao hủy bản chốt này?" className="min-w-[15rem]" />
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
