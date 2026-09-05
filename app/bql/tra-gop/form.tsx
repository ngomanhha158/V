'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Select, Textarea, vnd } from '@/components/ui'
import { NHAN_CACH_CHIA, cacKy, ganhNang, kyVN } from '@/lib/tra-gop'
import { huyKeHoach, lapKeHoach, type TraGopState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies TraGopState

const kyToi = () => {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function FormLap({ project, soCan }: { project: string; soCan: number }) {
  const [state, action, dangChay] = useActionState(lapKeHoach, dauTien)
  const [tong, setTong] = useState('')
  const [soDot, setSoDot] = useState(3)
  const [ky, setKy] = useState(kyToi())

  const so = Number(tong.replace(/[^\d]/g, ''))
  // Con số quyết định KHÔNG phải tổng chi phí mà là "mỗi tháng nặng thêm bao
  // nhiêu". Hiện nó ngay khi gõ, chứ không để người ta bấm rồi mới thấy.
  const g = so > 0 ? ganhNang(so, soCan, soDot) : null
  const ky_ = /^\d{4}-\d{2}$/.test(ky) ? cacKy(`${ky}-01`, soDot) : []

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      <Field
        label="Tên khoản thu"
        hint="In NGUYÊN VĂN lên hóa đơn của từng nhà, kèm 'đợt 2/3'. Viết như một dòng hóa đơn."
      >
        <Input name="ten" required minLength={3} placeholder="Sơn lại mặt ngoài tháp A" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tổng chi phí (đ)" hint="Đúng số trên hóa đơn nhà thầu">
          <Input
            name="tong" required inputMode="numeric" className="num"
            value={tong} onChange={(e) => setTong(e.target.value)}
            placeholder="2100000000"
          />
        </Field>
        <Field label="Cách chia" hint="Chia theo diện tích cần mọi căn đã có m²">
          <Select name="cach_chia" defaultValue="theo_m2">
            {Object.entries(NHAN_CACH_CHIA).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Số đợt" hint="Tối đa 36. Dài hơn ba năm thì đó không còn là chia đợt.">
          <Input
            type="number" name="so_dot" required min={1} max={36} className="num"
            value={soDot} onChange={(e) => setSoDot(Number(e.target.value))}
          />
        </Field>
        <Field label="Kỳ bắt đầu" hint="Đợt 1 nằm trong hóa đơn của kỳ này">
          <Input
            type="month" name="ky" required className="num"
            value={ky} onChange={(e) => setKy(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Số nghị quyết" hint="Bắt buộc — hệ thống từ chối nếu để trống">
          <Input name="nghi_quyet" required placeholder="NQ-05/2026" />
        </Field>
        <Field label="Ngày nghị quyết" hint="Không bắt buộc">
          <Input type="date" name="ngay_nq" className="num" />
        </Field>
      </div>
      <Field label="Giải trình" hint="Không bắt buộc — vì sao phải chi, đã chọn nhà thầu nào">
        <Textarea name="mo_ta" rows={2} />
      </Field>

      {g && (
        <Hop tone="brand" title="Mỗi nhà thấy gì trên hóa đơn">
          <span className="block">
            Thu một lần: <b className="num">{vnd(g.moiCan)}</b> mỗi căn, trong một tháng.
          </span>
          <span className="mt-1 block">
            Chia {g.soDot} đợt: <b className="num">{vnd(g.moiThang)}</b> mỗi tháng, cộng vào
            hóa đơn các kỳ{' '}
            <span className="num">{ky_.map(kyVN).join(', ')}</span>.
          </span>
          <span className="mt-1 block text-[0.75rem]">
            Con số bên trên là chia đều để hình dung; chia theo diện tích thì căn to
            trả nhiều hơn, căn nhỏ trả ít hơn, và tổng vẫn đúng bằng chi phí.
          </span>
        </Hop>
      )}

      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang lập…' : 'Lập kế hoạch thu'}
      </Button>
    </form>
  )
}

export function NutDung({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(huyKeHoach, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  if (!mo) return <Button type="button" co="sm" onClick={() => setMo(true)}>Dừng thu</Button>
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Input name="ly_do" autoFocus placeholder="Vì sao dừng thu?" className="min-w-[15rem]" />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
          {dangChay ? 'Đang dừng…' : 'Xác nhận dừng'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
      <p className="max-w-md text-[0.75rem] leading-relaxed text-muted">
        Các đợt đã nằm trên hóa đơn ĐÃ PHÁT HÀNH giữ nguyên. Chỉ những đợt chưa
        tới kỳ mới dừng lại.
      </p>
    </form>
  )
}
