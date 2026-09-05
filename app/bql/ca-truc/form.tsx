'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Pill, Select, Textarea, cx } from '@/components/ui'
import { NHAN_MUC_DO, TONE_MUC_DO, coBanGiaoDuoc } from '@/lib/ca-truc'
import { banGiao, ketCa, kyNhan, vaoCa, type CaState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies CaState

export function FormVaoCa({ ca }: { ca: { id: string; ten: string; gio: string }[] }) {
  const [state, action, dangChay] = useActionState(vaoCa, dauTien)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Ca của bạn" className="min-w-[12rem]">
        <Select name="ca" required defaultValue={ca[0]?.id}>
          {ca.map((c) => <option key={c.id} value={c.id}>{c.ten} · {c.gio}</option>)}
        </Select>
      </Field>
      <Button type="submit" dang="chinh" disabled={dangChay}>
        {dangChay ? 'Đang vào ca…' : 'Vào ca'}
      </Button>
      {state.error && <Hop tone="xau" className="w-full">{state.error}</Hop>}
    </form>
  )
}

export function FormBanGiao({
  phienCuaToi, nguoiKhac, viecMo,
}: {
  phienCuaToi: { phien_id: string; ca: string } | null
  nguoiKhac: { phien_id: string; ca: string; ho_ten: string | null }[]
  viecMo: { id: string; title: string; priority: string; ma_can: string }[]
}) {
  const [state, action, dangChay] = useActionState(banGiao, dauTien)
  const kt = coBanGiaoDuoc(phienCuaToi, nguoiKhac)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  if (!kt.duoc) {
    return (
      <div className="space-y-3">
        <Hop tone="canh">{kt.loi}</Hop>
        {phienCuaToi && <FormKetCa phien={phienCuaToi.phien_id} />}
      </div>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="phien_ra" value={phienCuaToi!.phien_id} />
      <Field label="Bàn giao cho" hint="Chỉ hiện những người đã vào ca">
        <Select name="phien_vao" required>
          {nguoiKhac.map((n) => (
            <option key={n.phien_id} value={n.phien_id}>
              {n.ho_ten ?? 'Chưa có tên'} · {n.ca}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Tình hình ca"
        hint='Bắt buộc. "Không có gì bất thường" cũng là một câu phải viết ra — im lặng và bình yên trông giống hệt nhau trong sổ.'
      >
        <Textarea
          name="tinh_hinh" required rows={3}
          placeholder="Bơm tầng hầm kêu bất thường từ 2h. Đã tắt luân phiên, chờ kỹ thuật sáng."
        />
      </Field>

      {viecMo.length > 0 && (
        <Field
          label="Việc chuyển tiếp"
          hint="Tích những việc ca sau phải theo. Ca sau bấm mở được từng việc — nên đây là danh sách để làm, không phải một dòng ghi chú."
        >
          <div className="max-h-56 space-y-1.5 overflow-auto rounded-ctl border border-line p-2">
            {viecMo.map((v) => (
              <label
                key={v.id}
                className="flex cursor-pointer items-start gap-2 rounded-ctl px-2 py-1.5 hover:bg-sunken"
              >
                <input type="checkbox" name="viec" value={v.id} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1 text-[0.8125rem]">
                  <span className={cx('font-medium text-ink')}>{v.title}</span>
                  <span className="num text-faint"> · {v.ma_can}</span>
                </span>
                <Pill tone={TONE_MUC_DO[v.priority] ?? 'trung'}>
                  {NHAN_MUC_DO[v.priority] ?? v.priority}
                </Pill>
              </label>
            ))}
          </div>
        </Field>
      )}

      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <Button type="submit" dang="chinh" disabled={dangChay}>
        {dangChay ? 'Đang bàn giao…' : 'Bàn giao và kết ca'}
      </Button>
      <p className="text-[0.75rem] leading-relaxed text-muted">
        Bấm nút này là kết luôn ca của bạn. Hai việc đó cố ý đi liền nhau: tách ra
        thì lại có người về mà chưa bàn giao.
      </p>
    </form>
  )
}

export function NutKyNhan({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(kyNhan, dauTien)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang ký…' : 'Ký nhận ca'}
      </Button>
    </form>
  )
}

export function FormKetCa({ phien }: { phien: string }) {
  const [state, action, dangChay] = useActionState(ketCa, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  if (!mo) {
    return (
      <Button type="button" co="sm" onClick={() => setMo(true)}>
        Kết ca không bàn giao
      </Button>
    )
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="phien" value={phien} />
      <Field label="Lý do" hint="Dòng này nằm lại trong sổ để ban quản lý biết đã có khoảng trống">
        <Textarea name="ly_do" rows={2} autoFocus placeholder="Ca sau không ai tới, đã báo trưởng BQL lúc 6h10." />
      </Field>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
          {dangChay ? 'Đang kết…' : 'Xác nhận kết ca'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}
