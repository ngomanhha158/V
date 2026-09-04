'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Textarea } from '@/components/ui'
import { dongCuoc, huyCuoc, huyPhieu, moCuoc, type BQState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies BQState

export function FormMo({ project }: { project: string }) {
  const [state, action, dangChay] = useActionState(moCuoc, dauTien)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      <Field
        label="Nội dung đưa ra biểu quyết"
        hint="Câu này in nguyên văn lên lá phiếu và vào biên bản. Viết như một nghị quyết, không như một tiêu đề."
      >
        <Input name="tieu_de" required minLength={5} placeholder="Thông qua mức phí quản lý 8.000đ/m² từ 01/2027" />
      </Field>
      <Field label="Giải trình" hint="Không bắt buộc — vì sao đưa ra, phương án so sánh, con số kèm theo">
        <Textarea name="noi_dung" rows={3} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Ngưỡng dự họp (%)"
          hint="Bao nhiêu % DIỆN TÍCH TOÀN KHU phải bỏ phiếu thì hội nghị mới đủ điều kiện tiến hành."
        >
          <Input type="number" name="nguong_du_hop" required min={1} max={100} step="0.01" defaultValue={50} className="num" />
        </Field>
        <Field
          label="Ngưỡng thông qua (%)"
          hint="Bao nhiêu % DIỆN TÍCH ĐÃ BỎ PHIẾU phải tán thành. Mẫu số khác hẳn ô bên trái."
        >
          <Input type="number" name="nguong_thong_qua" required min={1} max={100} step="0.01" defaultValue={50} className="num" />
        </Field>
      </div>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang mở…' : 'Mở cuộc biểu quyết'}
      </Button>
    </form>
  )
}

export function NutDong({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(dongCuoc, dauTien)
  const [chac, setChac] = useState(false)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {chac ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
            {dangChay ? 'Đang kiểm…' : 'Chốt kết quả, không mở lại'}
          </Button>
          <Button type="button" co="sm" onClick={() => setChac(false)}>Thôi</Button>
        </div>
      ) : (
        <Button type="button" dang="chinh" co="sm" onClick={() => setChac(true)}>
          Kiểm phiếu và đóng
        </Button>
      )}
      {chac && (
        <p className="max-w-md text-[0.75rem] leading-relaxed text-muted">
          Đóng là chốt: con số hiện tại được lưu lại, không ai bỏ thêm phiếu và
          không hủy được phiếu nào nữa. Cuộc đã đóng cũng không hủy được.
        </p>
      )}
    </form>
  )
}

export function NutHuyCuoc({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(huyCuoc, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <span className="text-[0.75rem] text-muted">{state.ok}</span>
  if (!mo) return <Button type="button" co="sm" onClick={() => setMo(true)}>Hủy cuộc</Button>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Input name="ly_do" autoFocus placeholder="Vì sao hủy cuộc này?" className="min-w-[15rem]" />
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

export function NutHuyPhieu({ phieu, bq, can }: { phieu: string; bq: string; can: string }) {
  const [state, action, dangChay] = useActionState(huyPhieu, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <span className="text-[0.75rem] text-muted">{state.ok}</span>
  if (!mo) {
    return (
      <Button type="button" co="sm" onClick={() => setMo(true)}>
        Hủy phiếu
      </Button>
    )
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="phieu" value={phieu} />
      <input type="hidden" name="bq" value={bq} />
      <Input
        name="ly_do"
        autoFocus
        placeholder={`Vì sao hủy phiếu của căn ${can}?`}
        className="min-w-[14rem]"
      />
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
