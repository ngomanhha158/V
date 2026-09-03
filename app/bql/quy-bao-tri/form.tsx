'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Select, Textarea } from '@/components/ui'
import { NHAN_LOAI } from '@/lib/quy'
import { daoQuy, datDoiChieu, ghiQuy, type QuyState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies QuyState
const homNay = () => new Date().toISOString().slice(0, 10)

export function FormGhi({ project, coSoDuDau }: { project: string; coSoDuDau: boolean }) {
  const [state, action, dangChay] = useActionState(ghiQuy, dauTien)
  const [loai, setLoai] = useState(coSoDuDau ? 'thu' : 'so_du_dau')
  const laChi = loai === 'chi'

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Loại bút toán">
          <Select name="loai" value={loai} onChange={(e) => setLoai(e.target.value)}>
            {/* Số dư đầu kỳ chỉ ghi được một lần, nên ghi rồi thì bỏ hẳn khỏi ô
                chọn — để đó là mời bấm vào rồi nhận một lỗi. */}
            {(coSoDuDau ? ['thu', 'lai', 'chi'] : ['so_du_dau', 'thu', 'lai', 'chi']).map((l) => (
              <option key={l} value={l}>{NHAN_LOAI[l]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Ngày">
          <Input type="date" name="ngay" required defaultValue={homNay()} className="num" />
        </Field>
        <Field
          label="Số tiền"
          hint={laChi ? 'Nhập số dương — loại bút toán quyết định dấu' : undefined}
        >
          <Input name="so_tien" inputMode="numeric" placeholder="96.000.000" required className="num" />
        </Field>
      </div>

      <Field label="Diễn giải" hint="Năm sau người khác đọc lại phải hiểu được">
        <Input name="dien_giai" required placeholder="Sửa thang máy tháp A" />
      </Field>

      {laChi && (
        <div className="rounded-card border border-warn-line bg-warn-soft p-3">
          <p className="text-[0.8125rem] font-semibold text-warn">Khoản chi phải có nghị quyết BQT</p>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
            Điều kiện của luật, không phải quy trình nội bộ. Thiếu số hoặc thiếu
            ngày thì hệ thống không ghi.
          </p>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <Field label="Số nghị quyết">
              <Input name="nghi_quyet" placeholder="NQ-03/2026" required className="num" />
            </Field>
            <Field label="Ngày nghị quyết">
              <Input type="date" name="ngay_nq" required className="num" />
            </Field>
          </div>
        </div>
      )}

      <Field label="Ghi chú" hint="Không bắt buộc">
        <Textarea name="ghi_chu" rows={2} />
      </Field>

      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" dang="chinh" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang ghi…' : 'Ghi vào sổ'}
      </Button>
    </form>
  )
}

export function NutDao({ id, dienGiai }: { id: string; dienGiai: string }) {
  const [state, action, dangChay] = useActionState(daoQuy, dauTien)
  const [mo, setMo] = useState(false)

  if (!mo) {
    return (
      <>
        <Button type="button" co="sm" onClick={() => setMo(true)}>Đảo</Button>
        {state.ok && <Hop tone="tot" className="mt-2">{state.ok}</Hop>}
      </>
    )
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Input name="ly_do" autoFocus placeholder={`Vì sao đảo "${dienGiai}"?`} className="min-w-[15rem]" />
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>
          {dangChay ? 'Đang ghi…' : 'Ghi bút toán đảo'}
        </Button>
        <Button type="button" co="sm" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}

export function FormDoiChieu({
  project, nganHang, soTaiKhoan, soDu, ngay,
}: {
  project: string; nganHang?: string; soTaiKhoan?: string; soDu?: number | null; ngay?: string | null
}) {
  const [state, action, dangChay] = useActionState(datDoiChieu, dauTien)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ngân hàng">
          <Input name="ngan_hang" defaultValue={nganHang} placeholder="Vietcombank" />
        </Field>
        <Field label="Số tài khoản riêng của quỹ" hint="Khác tài khoản thu phí quản lý">
          <Input name="so_tai_khoan" defaultValue={soTaiKhoan} className="num" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Số dư ngân hàng báo">
          <Input name="so_du" inputMode="numeric" required defaultValue={soDu ?? undefined} className="num" />
        </Field>
        <Field label="Ngày của sao kê">
          <Input type="date" name="ngay" required defaultValue={ngay ?? homNay()} className="num" />
        </Field>
      </div>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}
      <Button type="submit" co="sm" disabled={dangChay}>
        {dangChay ? 'Đang lưu…' : 'Cập nhật số liệu ngân hàng'}
      </Button>
    </form>
  )
}
