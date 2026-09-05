'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Textarea, vnd } from '@/components/ui'
import { goiYKyQuy, soNgay } from '@/lib/thi-cong'
import { duyet, ghiKyQuy, huy, tatToan, tuChoi, type TCState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies TCState

export function FormDuyet({
  id, loai, tu, den, gioBd, gioKt, lamCN,
}: {
  id: string; loai: string; tu: string; den: string
  gioBd: string; gioKt: string; lamCN: boolean
}) {
  const [state, action, dangChay] = useActionState(duyet, dauTien)
  const [mo, setMo] = useState(false)
  const goiY = goiYKyQuy(loai, soNgay(tu, den))
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  if (!mo) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" dang="chinh" co="sm" onClick={() => setMo(true)}>Duyệt</Button>
        <NutTuChoi id={id} />
      </div>
    )
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field
        label="Mức ký quỹ (đ)"
        hint={`Gợi ý ${vnd(goiY)} cho ${soNgay(tu, den)} ngày. Đây CHỈ là gợi ý — bạn gõ đè được, và con số cuối cùng là con số bạn ký tên.`}
      >
        <Input name="ky_quy" required inputMode="numeric" className="num" defaultValue={goiY} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Giờ được phép từ" hint="Siết lại được so với đơn xin">
          <Input type="time" name="gio_bat_dau" className="num" defaultValue={gioBd.slice(0, 5)} />
        </Field>
        <Field label="Đến" hint="Ghi thẳng vào giấy phép, không nhắn riêng">
          <Input type="time" name="gio_ket_thuc" className="num" defaultValue={gioKt.slice(0, 5)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[0.8125rem] text-ink">
        <input type="checkbox" name="lam_chu_nhat" defaultChecked={lamCN} />
        Cho phép thi công chủ nhật
      </label>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
          {dangChay ? 'Đang duyệt…' : 'Xác nhận duyệt'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}

export function NutTuChoi({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(tuChoi, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  if (!mo) return <Button type="button" co="sm" onClick={() => setMo(true)}>Từ chối</Button>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Textarea name="ly_do" rows={2} autoFocus placeholder="Đục tường chịu lực phải có hồ sơ kết cấu" />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
          {dangChay ? 'Đang gửi…' : 'Xác nhận từ chối'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}

export function FormKyQuy({ id, conThieu }: { id: string; conThieu: number }) {
  const [state, action, dangChay] = useActionState(ghiKyQuy, dauTien)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <Field label="Ghi nhận ký quỹ đã nhận (đ)" className="min-w-[12rem]">
        <Input name="so_tien" required inputMode="numeric" className="num" defaultValue={conThieu > 0 ? conThieu : ''} />
      </Field>
      <Button type="submit" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang ghi…' : 'Ghi nhận'}
      </Button>
      {state.error && <Hop tone="xau" className="w-full">{state.error}</Hop>}
    </form>
  )
}

export function FormTatToan({ id, daNop }: { id: string; daNop: number }) {
  const [state, action, dangChay] = useActionState(tatToan, dauTien)
  const [mo, setMo] = useState(false)
  const [tru, setTru] = useState('0')
  const so = Number(tru.replace(/[^\d]/g, '')) || 0
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  if (!mo) {
    return <Button type="button" dang="chinh" co="sm" onClick={() => setMo(true)}>Tất toán ký quỹ</Button>
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Trừ (đ)" hint={`Đã nhận ${vnd(daNop)}. Để 0 nếu không có hư hỏng gì.`}>
        <Input
          name="tru" inputMode="numeric" className="num"
          value={tru} onChange={(e) => setTru(e.target.value)}
        />
      </Field>
      {so > 0 && (
        <Field label="Lý do trừ" hint="Bắt buộc — đây là tiền của cư dân">
          <Textarea name="ly_do_tru" rows={2} placeholder="Xước sàn thang máy, chi phí đánh bóng" />
        </Field>
      )}
      <Hop tone={so > daNop ? 'xau' : 'trung'}>
        {so > daNop
          ? `Trừ ${vnd(so)} nhưng chỉ nhận ${vnd(daNop)}.`
          : <>Hoàn lại cư dân: <b className="num">{vnd(daNop - so)}</b></>}
      </Hop>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" dang="chinh" co="sm" disabled={dangChay || so > daNop}>
          {dangChay ? 'Đang tất toán…' : 'Xác nhận tất toán'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}

export function NutHuy({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(huy, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <span className="text-[0.75rem] text-muted">{state.ok}</span>
  if (!mo) return <Button type="button" co="sm" onClick={() => setMo(true)}>Hủy</Button>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Input name="ly_do" autoFocus placeholder="Vì sao hủy?" className="min-w-[14rem]" />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
          {dangChay ? 'Đang hủy…' : 'Xác nhận'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}
