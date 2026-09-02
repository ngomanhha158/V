'use client'

import { useState } from 'react'
import { Button, Field, Hop, Input, Pill, Select, vnd } from '@/components/ui'
import { CACH_TINH } from '@/app/bql/bieu-phi/form'
import type { BieuPhiDemo } from '@/lib/demo/data'

// Bản demo không import actions.ts — nó chỉ diễn lại luồng bấm, không ghi gì.
// CACH_TINH thì dùng chung với màn thật: nhãn và lời giải thích cách tính lệch
// nhau giữa hai màn là bản demo dạy sai người dùng.

const DIEN_TICH_MAU = 78

function XemTruoc({ gia, cach }: { gia: string; cach: string }) {
  const so = Number(gia.replace(/[.\s,]/g, ''))
  if (!Number.isSafeInteger(so) || so <= 0) return null
  if (cach === 'fixed') {
    return <p className="mt-1.5 text-[0.75rem] text-muted">Mỗi căn trả <strong>{vnd(so)}</strong> một tháng.</p>
  }
  if (cach === 'per_m2') {
    return <p className="mt-1.5 text-[0.75rem] text-muted">
      Căn {DIEN_TICH_MAU} m² sẽ là <strong>{vnd(so * DIEN_TICH_MAU)}</strong> một tháng.
    </p>
  }
  return <p className="mt-1.5 text-[0.75rem] text-muted">
    Dùng 10 đơn vị thì trả <strong>{vnd(so * 10)}</strong>.
  </p>
}

export function FormThemDemo() {
  const [cach, setCach] = useState('fixed')
  const [gia, setGia] = useState('')
  const [xong, setXong] = useState(false)

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="Mã phí" hint="Viết hoa, không dấu">
          <Input placeholder="QL" className="num" />
        </Field>
        <Field label="Tên phí"><Input placeholder="Phí quản lý" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cách tính" hint={CACH_TINH[cach]?.giaiThich}>
          <Select value={cach} onChange={(e) => setCach(e.target.value)}>
            {Object.entries(CACH_TINH).map(([v, c]) => <option key={v} value={v}>{c.nhan}</option>)}
          </Select>
        </Field>
        <Field label={`Đơn giá (${CACH_TINH[cach]?.nhanGia})`}>
          <Input
            inputMode="numeric" className="num" placeholder="16500"
            value={gia} onChange={(e) => setGia(e.target.value)}
          />
          <XemTruoc gia={gia} cach={cach} />
        </Field>
      </div>
      {xong && <Hop tone="brand">Bản demo: sẽ thêm loại phí này vào biểu phí của khu.</Hop>}
      <Button dang="chinh" onClick={() => setXong(true)}>Thêm biểu phí</Button>
    </div>
  )
}

function Dong({ b }: { b: BieuPhiDemo }) {
  const [mo, setMo] = useState(false)
  const [cach, setCach] = useState(b.calc_method)
  const [gia, setGia] = useState(String(b.unit_price ?? ''))
  const [xong, setXong] = useState<'sua' | 'xoa' | null>(null)

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-[0.9375rem] font-semibold text-ink">{b.code}</span>
            <span className="text-[0.9375rem] text-ink">{b.name}</span>
            <Pill tone="trung">{CACH_TINH[b.calc_method]?.nhan ?? b.calc_method}</Pill>
          </div>
          <p className="num mt-1 text-[0.8125rem] text-muted">
            {vnd(b.unit_price ?? 0)}{' '}
            <span className="text-faint">/ {CACH_TINH[b.calc_method]?.nhanGia.replace('đồng / ', '')}</span>
          </p>
        </div>
        {!mo && (
          <div className="flex gap-2">
            <Button type="button" onClick={() => setMo(true)}>Sửa</Button>
            <Button type="button" onClick={() => setXong('xoa')}>Xóa</Button>
          </div>
        )}
      </div>

      {mo && (
        <div className="mt-3 space-y-3 rounded-ctl border border-line bg-sunken p-3">
          <Field label="Tên phí"><Input defaultValue={b.name} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cách tính" hint={CACH_TINH[cach]?.giaiThich}>
              <Select value={cach} onChange={(e) => setCach(e.target.value)}>
                {Object.entries(CACH_TINH).map(([v, c]) => <option key={v} value={v}>{c.nhan}</option>)}
              </Select>
            </Field>
            <Field label={`Đơn giá (${CACH_TINH[cach]?.nhanGia})`}>
              <Input inputMode="numeric" className="num" value={gia}
                onChange={(e) => setGia(e.target.value)} />
              <XemTruoc gia={gia} cach={cach} />
            </Field>
          </div>
          {xong === 'sua' && <Hop tone="brand">Bản demo: sẽ đổi giá {b.name} từ kỳ sinh sau.</Hop>}
          <div className="flex gap-2">
            <Button dang="chinh" onClick={() => setXong('sua')}>Lưu</Button>
            <Button type="button" onClick={() => { setMo(false); setXong(null) }}>Thôi</Button>
          </div>
        </div>
      )}

      {xong === 'xoa' && (
        <div className="mt-2">
          <Hop tone="brand">
            Bản demo: màn thật sẽ từ chối xóa nếu phí này đã nằm trong hóa đơn đã phát —
            xóa đi là mất dấu vết tiền đã thu.
          </Hop>
        </div>
      )}
    </li>
  )
}

export function DanhSachPhiDemo({ ds }: { ds: BieuPhiDemo[] }) {
  return <ul className="divide-y divide-line">{ds.map((b) => <Dong key={b.id} b={b} />)}</ul>
}
