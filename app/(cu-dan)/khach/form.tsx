'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button, Field, Hop, Input, Select } from '@/components/ui'
import { moiKhach, thuHoi, type KhachState } from './actions'

const dauTien = { error: undefined, ok: undefined, id: undefined } satisfies KhachState

/** "2026-09-03T14:00" theo giờ máy người dùng, dạng mà <input datetime-local> hiểu. */
function moc(themGio: number) {
  const d = new Date(Date.now() + themGio * 3_600_000)
  d.setMinutes(0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function FormMoi({ canDs }: { canDs: { id: string; nhan: string }[] }) {
  const [state, action, dangChay] = useActionState(moiKhach, dauTien)

  return (
    <form action={action} className="space-y-3">
      {canDs.length === 1 ? (
        <input type="hidden" name="unit" value={canDs[0].id} />
      ) : (
        <Field label="Căn hộ">
          <Select name="unit" required defaultValue="">
            <option value="" disabled>— Chọn căn —</option>
            {canDs.map((c) => <option key={c.id} value={c.id}>{c.nhan}</option>)}
          </Select>
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên khách" hint="Bảo vệ đối chiếu bằng tên khi khách tới">
          <Input name="ho_ten" required placeholder="Nguyễn Thị Lan" />
        </Field>
        <Field label="Số điện thoại" hint="Không bắt buộc — để bảo vệ gọi được nếu cần">
          <Input name="dien_thoai" inputMode="tel" className="num" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Từ">
          <Input type="datetime-local" name="tu" required defaultValue={moc(0)} className="num" />
        </Field>
        <Field label="Đến">
          <Input type="datetime-local" name="den" required defaultValue={moc(4)} className="num" />
        </Field>
      </div>

      <Field label="Lý do" hint="Không bắt buộc">
        <Input name="ly_do" placeholder="Tới chơi" />
      </Field>

      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && state.id && (
        <Hop tone="tot" title="Đã tạo mã khách">
          <Link href={`/khach/${state.id}`} className="font-medium text-brand hover:underline">
            Mở mã ra để gửi cho khách →
          </Link>
        </Hop>
      )}

      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang tạo…' : 'Tạo mã khách'}
      </Button>
    </form>
  )
}

export function NutThuHoi({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(thuHoi, dauTien)
  if (state.ok) return <span className="text-[0.75rem] text-muted">{state.ok}</span>
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state.error && <Hop tone="xau" className="mb-2">{state.error}</Hop>}
      <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
        {dangChay ? 'Đang thu hồi…' : 'Thu hồi'}
      </Button>
    </form>
  )
}
