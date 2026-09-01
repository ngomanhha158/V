'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Pill, Select, vnd } from '@/components/ui'
import { suaBieuPhi, themBieuPhi, xoaBieuPhi, type BieuPhiState } from './actions'

export type BieuPhi = {
  id: string
  code: string
  name: string
  unit_price: number | null
  calc_method: string
}

const dauTien = { error: undefined, ok: undefined } satisfies BieuPhiState

export const CACH_TINH: Record<string, { nhan: string; nhanGia: string; giaiThich: string }> = {
  fixed: {
    nhan: 'Cố định mỗi căn',
    nhanGia: 'đồng / căn / tháng',
    giaiThich: 'Mọi căn trả như nhau, không phụ thuộc diện tích hay chỉ số.',
  },
  per_m2: {
    nhan: 'Theo mét vuông',
    nhanGia: 'đồng / m² / tháng',
    giaiThich: 'Nhân với diện tích của căn. Căn chưa có diện tích sẽ ra 0 đồng.',
  },
  metered: {
    nhan: 'Theo chỉ số công tơ',
    nhanGia: 'đồng / đơn vị',
    giaiThich: 'Nhân với (chỉ số cuối − chỉ số đầu) của kỳ. Căn chưa ghi chỉ số sẽ không có dòng phí này.',
  },
}

const tenCach = (v: string) => CACH_TINH[v]?.nhan ?? v

/** Đọc lại thành tiền ngay dưới ô nhập. Gõ nhầm một số 0 vào đơn giá của 468
 *  căn là sai vài trăm triệu, mà nhìn dãy số trần thì rất khó thấy. */
function XemTruoc({ gia, cach, dienTichMau }: { gia: string; cach: string; dienTichMau: number | null }) {
  const so = Number(gia.replace(/[.\s,]/g, ''))
  if (!Number.isSafeInteger(so) || so <= 0) return null

  if (cach === 'fixed') {
    return <p className="mt-1.5 text-[0.75rem] text-muted">Mỗi căn trả <strong>{vnd(so)}</strong> một tháng.</p>
  }
  if (cach === 'per_m2') {
    return dienTichMau
      ? <p className="mt-1.5 text-[0.75rem] text-muted">
          Căn {dienTichMau} m² sẽ là <strong>{vnd(so * dienTichMau)}</strong> một tháng.
        </p>
      : <p className="mt-1.5 text-[0.75rem] text-bad">
          Chưa căn nào có diện tích, nên phí này sẽ ra <strong>0 đồng</strong> cho tất cả.
        </p>
  }
  return <p className="mt-1.5 text-[0.75rem] text-muted">
    Dùng 10 đơn vị thì trả <strong>{vnd(so * 10)}</strong>.
  </p>
}

export function FormThem({ dienTichMau }: { dienTichMau: number | null }) {
  const [s, act, dang] = useActionState(themBieuPhi, dauTien)
  const [cach, setCach] = useState('fixed')
  const [gia, setGia] = useState('')

  return (
    <form action={act} className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="Mã phí" hint="Viết hoa, không dấu">
          <Input name="code" required placeholder="QL" className="num" />
        </Field>
        <Field label="Tên phí">
          <Input name="name" required placeholder="Phí quản lý" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cách tính" hint={CACH_TINH[cach]?.giaiThich}>
          <Select name="calc_method" value={cach} onChange={(e) => setCach(e.target.value)}>
            {Object.entries(CACH_TINH).map(([v, c]) => (
              <option key={v} value={v}>{c.nhan}</option>
            ))}
          </Select>
        </Field>
        <Field label={`Đơn giá (${CACH_TINH[cach]?.nhanGia})`}>
          <Input
            name="unit_price" required inputMode="numeric" className="num" placeholder="16500"
            value={gia} onChange={(e) => setGia(e.target.value)}
          />
          <XemTruoc gia={gia} cach={cach} dienTichMau={dienTichMau} />
        </Field>
      </div>

      {s.error && <Hop tone="xau" title="Không thêm được">{s.error}</Hop>}
      {s.ok && <Hop tone="tot">{s.ok}</Hop>}

      <Button type="submit" dang="chinh" disabled={dang}>
        {dang ? 'Đang lưu…' : 'Thêm biểu phí'}
      </Button>
    </form>
  )
}

function Dong({ b, dienTichMau }: { b: BieuPhi; dienTichMau: number | null }) {
  const [sSua, actSua, dangSua] = useActionState(suaBieuPhi, dauTien)
  const [sXoa, actXoa, dangXoa] = useActionState(xoaBieuPhi, dauTien)
  const [mo, setMo] = useState(false)
  const [cach, setCach] = useState(b.calc_method)
  const [gia, setGia] = useState(String(b.unit_price ?? ''))

  const canhBaoM2 = b.calc_method === 'per_m2' && !dienTichMau

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-[0.9375rem] font-semibold text-ink">{b.code}</span>
            <span className="text-[0.9375rem] text-ink">{b.name}</span>
            <Pill tone={canhBaoM2 ? 'xau' : 'trung'}>{tenCach(b.calc_method)}</Pill>
          </div>
          <p className="num mt-1 text-[0.8125rem] text-muted">
            {b.unit_price === null
              ? <span className="text-faint">chưa có đơn giá</span>
              : <>{vnd(b.unit_price)} <span className="text-faint">/ {CACH_TINH[b.calc_method]?.nhanGia.replace('đồng / ', '')}</span></>}
          </p>
          {canhBaoM2 && (
            <p className="mt-1.5 text-[0.75rem] text-bad">
              Chưa căn nào có diện tích — phí này đang ra 0 đồng cho mọi căn.
            </p>
          )}
        </div>

        {!mo && (
          <div className="flex gap-2">
            <Button type="button" onClick={() => setMo(true)}>Sửa</Button>
            <form action={actXoa}>
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="ten" value={`${b.code} — ${b.name}`} />
              <Button type="submit" disabled={dangXoa}>{dangXoa ? 'Đang xóa…' : 'Xóa'}</Button>
            </form>
          </div>
        )}
      </div>

      {mo && (
        <form action={actSua} className="mt-3 space-y-3 rounded-ctl border border-line bg-sunken p-3">
          <input type="hidden" name="id" value={b.id} />
          <Field label="Tên phí">
            <Input name="name" required defaultValue={b.name} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cách tính" hint={CACH_TINH[cach]?.giaiThich}>
              <Select name="calc_method" value={cach} onChange={(e) => setCach(e.target.value)}>
                {Object.entries(CACH_TINH).map(([v, c]) => (
                  <option key={v} value={v}>{c.nhan}</option>
                ))}
              </Select>
            </Field>
            <Field label={`Đơn giá (${CACH_TINH[cach]?.nhanGia})`}>
              <Input
                name="unit_price" required inputMode="numeric" className="num"
                value={gia} onChange={(e) => setGia(e.target.value)}
              />
              <XemTruoc gia={gia} cach={cach} dienTichMau={dienTichMau} />
            </Field>
          </div>
          {sSua.error && <Hop tone="xau">{sSua.error}</Hop>}
          {sSua.ok && <Hop tone="tot">{sSua.ok}</Hop>}
          <div className="flex gap-2">
            <Button type="submit" dang="chinh" disabled={dangSua}>
              {dangSua ? 'Đang lưu…' : 'Lưu'}
            </Button>
            <Button type="button" onClick={() => setMo(false)}>Thôi</Button>
          </div>
        </form>
      )}

      {sXoa.error && <div className="mt-2"><Hop tone="xau" title="Không xóa được">{sXoa.error}</Hop></div>}
    </li>
  )
}

export function DanhSachPhi({ ds, dienTichMau }: { ds: BieuPhi[]; dienTichMau: number | null }) {
  return (
    <ul className="divide-y divide-line">
      {ds.map((b) => <Dong key={b.id} b={b} dienTichMau={dienTichMau} />)}
    </ul>
  )
}
