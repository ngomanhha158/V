'use client'

import { useActionState } from 'react'
import { Button, Field, Hop, Input, Select } from '@/components/ui'
import { LOAI_XE, NHAN_LOAI } from '@/lib/xe'
import { datHanMuc, goiNguoiTiepTheo, type BaiXeState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies BaiXeState

export function FormHanMuc({
  toaDs, toa, loai, tongCho, moiCan,
}: {
  toaDs: { id: string; name: string }[]
  toa?: string; loai?: string; tongCho?: number; moiCan?: number
}) {
  const [state, action, dangChay] = useActionState(datHanMuc, dauTien)
  const sua = Boolean(toa && loai)

  return (
    <form action={action} className="space-y-3">
      {sua ? (
        <>
          <input type="hidden" name="toa" value={toa} />
          <input type="hidden" name="loai" value={loai} />
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tòa">
            <Select name="toa" required defaultValue="">
              <option value="" disabled>— Chọn tòa —</option>
              {toaDs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Loại xe">
            <Select name="loai" required defaultValue="">
              <option value="" disabled>— Chọn loại —</option>
              {LOAI_XE.map((l) => <option key={l} value={l}>{NHAN_LOAI[l]}</option>)}
            </Select>
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Số chỗ trong hầm" hint="Đếm được ở hầm — đây là giới hạn vật lý">
          <Input type="number" name="tong_cho" min={0} required defaultValue={tongCho} className="num" />
        </Field>
        <Field label="Mỗi căn tối đa" hint="Giới hạn công bằng — không hộ nào ôm hết">
          <Input type="number" name="moi_can" min={0} required defaultValue={moiCan} className="num" />
        </Field>
      </div>

      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" co="sm" dang="chinh" disabled={dangChay}>
        {dangChay ? 'Đang lưu…' : sua ? 'Lưu hạn mức' : 'Đặt hạn mức'}
      </Button>
    </form>
  )
}

export function NutGoi({ toa, loai }: { toa: string; loai: string }) {
  const [state, action, dangChay] = useActionState(goiNguoiTiepTheo, dauTien)
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="toa" value={toa} />
      <input type="hidden" name="loai" value={loai} />
      <Button type="submit" co="sm" dang="phu" disabled={dangChay}>
        {dangChay ? 'Đang gọi…' : 'Gọi người tiếp theo'}
      </Button>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
    </form>
  )
}
