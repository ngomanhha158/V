'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Select, Textarea } from '@/components/ui'
import { NHAN_LOAI } from '@/lib/thi-cong'
import { dangKy, huyDon, type DangKyState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies DangKyState
const mai = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

export function FormDangKy({ can }: { can: { id: string; code: string }[] }) {
  const [state, action, dangChay] = useActionState(dangKy, dauTien)
  const [loai, setLoai] = useState('thi_cong')
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Căn hộ">
          <Select name="unit" required defaultValue={can[0]?.id}>
            {can.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Loại đăng ký">
          <Select name="loai" value={loai} onChange={(e) => setLoai(e.target.value)}>
            {Object.entries(NHAN_LOAI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
      </div>
      <Field
        label="Hạng mục"
        hint="Ghi rõ làm gì — ban quản lý duyệt dựa vào dòng này, và đục tường chịu lực thì cần hồ sơ kết cấu."
      >
        <Input name="hang_muc" required minLength={3} placeholder="Ốp lát, thạch cao trần" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Từ ngày">
          <Input type="date" name="tu" required className="num" defaultValue={mai()} min={mai()} />
        </Field>
        <Field label="Đến ngày" hint={loai === 'thi_cong' ? 'Xin dài hơn thì mức ký quỹ cao hơn' : 'Chuyển nhà thường gói trong một ngày'}>
          <Input type="date" name="den" required className="num" defaultValue={mai()} min={mai()} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Giờ làm từ" hint="Ban quản lý siết lại được">
          <Input type="time" name="gio_bat_dau" className="num" defaultValue="08:00" />
        </Field>
        <Field label="Đến">
          <Input type="time" name="gio_ket_thuc" className="num" defaultValue="17:00" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Đơn vị thi công" hint="Không bắt buộc">
          <Input name="don_vi" placeholder="Nội thất Nam Long" />
        </Field>
        <Field label="Điện thoại người phụ trách">
          <Input name="dien_thoai" inputMode="tel" className="num" placeholder="0912345678" />
        </Field>
      </div>
      <Field label="Số người vào làm" hint="Bảo vệ dùng con số này để đối chiếu ở sảnh">
        <Input type="number" name="so_nguoi" min={1} className="num w-28" />
      </Field>
      <Field label="Ghi chú" hint="Không bắt buộc">
        <Textarea name="ghi_chu" rows={2} />
      </Field>

      <Hop tone="trung" title="Cam kết khi đăng ký">
        <span className="block">
          Chỉ làm trong khung giờ được duyệt, không đục phá ngoài giờ và không làm
          chủ nhật trừ khi được cho phép riêng.
        </span>
        <span className="mt-1 block">
          Nộp ký quỹ theo mức ban quản lý ấn định. Hư hỏng thang máy, sảnh hay hạ
          tầng chung sẽ trừ vào ký quỹ kèm lý do ghi rõ; phần còn lại hoàn đủ khi
          tất toán.
        </span>
        <span className="mt-1 block">
          Vật liệu và rác thải tự vận chuyển, không để ở hành lang hay khu vực chung.
        </span>
      </Hop>

      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <Button type="submit" dang="chinh" disabled={dangChay}>
        {dangChay ? 'Đang gửi…' : 'Gửi đăng ký'}
      </Button>
    </form>
  )
}

export function NutHuyDon({ id }: { id: string }) {
  const [state, action, dangChay] = useActionState(huyDon, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  if (!mo) return <Button type="button" co="sm" onClick={() => setMo(true)}>Hủy đăng ký</Button>
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
