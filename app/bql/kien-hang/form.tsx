'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Select } from '@/components/ui'
import { LOAI_KIEN, nhanLoaiHoa } from '@/lib/kien-hang'
import { huyKien, nhanKien, type KienState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies KienState

export function FormNhan({ canDs }: { canDs: { id: string; ma: string }[] }) {
  const [state, action, dangChay] = useActionState(nhanKien, dauTien)

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Căn hộ" hint="Gõ mã căn để lọc">
          {/* datalist thay vì select: 468 căn trong một ô chọn thì cuộn tìm lâu
              hơn gõ, mà bảo vệ đang có người đứng chờ ở quầy. */}
          <Input name="unit_ma" list="ds-can" required placeholder="P1-12.04" className="num" />
          <datalist id="ds-can">
            {canDs.map((c) => <option key={c.id} value={c.ma} />)}
          </datalist>
        </Field>
        <Field label="Loại kiện">
          <Select name="loai" defaultValue="kien_nho">
            {LOAI_KIEN.map((l) => <option key={l} value={l}>{nhanLoaiHoa(l)}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Đơn vị vận chuyển" hint="Không bắt buộc">
          <Input name="nha_van_chuyen" placeholder="GHTK" />
        </Field>
        <Field label="Mã vận đơn" hint="Không bắt buộc">
          <Input name="ma_van_don" className="num" />
        </Field>
        <Field label="Để ở đâu" hint="Cư dân đọc được dòng này">
          <Input name="vi_tri" placeholder="Tủ A3" />
        </Field>
      </div>

      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang ghi…' : 'Ghi nhận kiện'}
      </Button>
    </form>
  )
}

export function NutHuy({ id, can }: { id: string; can: string }) {
  const [state, action, dangChay] = useActionState(huyKien, dauTien)
  const [mo, setMo] = useState(false)

  if (state.ok) return <span className="text-[0.75rem] text-muted">{state.ok}</span>
  if (!mo) return <Button type="button" co="sm" onClick={() => setMo(true)}>Hủy</Button>

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Input name="ly_do" autoFocus placeholder={`Vì sao hủy kiện của ${can}?`} className="min-w-[14rem]" />
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
