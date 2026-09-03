'use client'

import { useActionState } from 'react'
import { Button, Field, Hop, Input, Textarea } from '@/components/ui'
import { dongSuat, luuTienIch, themSuat, type BqlTiState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies BqlTiState

export function FormTienIch({
  project, ti,
}: {
  project: string
  ti?: {
    id: string; ten: string; mo_ta: string | null; dia_diem: string | null
    phi: number; toi_da_tuan: number; dat_truoc_ngay: number; dang_mo: boolean
  }
}) {
  const [state, action, dangChay] = useActionState(luuTienIch, dauTien)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      {ti && <input type="hidden" name="id" value={ti.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên tiện ích">
          <Input name="ten" required defaultValue={ti?.ten} placeholder="Sảnh sinh hoạt" />
        </Field>
        <Field label="Địa điểm" hint="Không bắt buộc">
          <Input name="dia_diem" defaultValue={ti?.dia_diem ?? ''} placeholder="Tầng 2, tháp A" />
        </Field>
      </div>

      <Field label="Mô tả" hint="Không bắt buộc">
        <Textarea name="mo_ta" rows={2} defaultValue={ti?.mo_ta ?? ''} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Phí một suất" hint="0 là miễn phí">
          <Input name="phi" inputMode="numeric" defaultValue={ti?.phi ?? 0} className="num" />
        </Field>
        <Field label="Mỗi căn / tuần" hint="Giữ công bằng — không hộ nào ôm hết">
          <Input name="toi_da_tuan" inputMode="numeric" defaultValue={ti?.toi_da_tuan ?? 2} className="num" />
        </Field>
        <Field label="Mở đặt trước (ngày)" hint="Dài quá thì vài người nhanh tay giữ cả năm">
          <Input name="dat_truoc_ngay" inputMode="numeric" defaultValue={ti?.dat_truoc_ngay ?? 14} className="num" />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="dang_mo" defaultChecked={ti?.dang_mo ?? true} className="size-4" />
        Đang mở cho cư dân đặt
      </label>

      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang lưu…' : ti ? 'Lưu' : 'Tạo tiện ích'}
      </Button>
    </form>
  )
}

export function FormSuat({ tienIch, thuTuKe }: { tienIch: string; thuTuKe: number }) {
  const [state, action, dangChay] = useActionState(themSuat, dauTien)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tien_ich" value={tienIch} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Thứ tự">
          <Input name="thu_tu" inputMode="numeric" defaultValue={thuTuKe} className="num" />
        </Field>
        <Field label="Từ">
          <Input type="time" name="bat_dau" required className="num" />
        </Field>
        <Field label="Đến">
          <Input type="time" name="ket_thuc" required className="num" />
        </Field>
      </div>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang thêm…' : 'Thêm khung giờ'}
      </Button>
    </form>
  )
}

export function FormDong({ suatDs }: { suatDs: { id: string; nhan: string }[] }) {
  const [state, action, dangChay] = useActionState(dongSuat, dauTien)
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Khung giờ">
          <select
            name="suat"
            required
            defaultValue=""
            className="h-10 w-full rounded-lg border border-line-firm bg-surface px-3 text-sm text-ink"
          >
            <option value="" disabled>— Chọn khung giờ —</option>
            {suatDs.map((s) => <option key={s.id} value={s.id}>{s.nhan}</option>)}
          </select>
        </Field>
        <Field label="Ngày">
          <Input type="date" name="ngay" required className="num" />
        </Field>
      </div>
      <Field label="Lý do" hint="Cư dân nhìn thấy đúng dòng chữ này trên lịch">
        <Input name="ly_do" required placeholder="Vệ sinh định kỳ" />
      </Field>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
        {dangChay ? 'Đang đóng…' : 'Đóng suất'}
      </Button>
    </form>
  )
}
