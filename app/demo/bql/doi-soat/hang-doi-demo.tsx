'use client'

import { useState } from 'react'
import { Button, Field, Hop, Pill, Select, ngayGioVN, vnd } from '@/components/ui'
import { CONG_NO, type GiaoDichDemo } from '@/lib/demo/data'

/** Bản demo: cùng bố cục với màn thật, nhưng nút không ghi gì cả. */
export function HangDoiDemo({ ds }: { ds: GiaoDichDemo[] }) {
  const canHo = [...new Set(CONG_NO.map((c) => c.unit_code))].sort()
  return (
    <ul className="divide-y divide-line">
      {ds.map((gd) => <Dong key={gd.id} gd={gd} canHo={canHo} />)}
    </ul>
  )
}

function Dong({ gd, canHo }: { gd: GiaoDichDemo; canHo: string[] }) {
  const [xong, setXong] = useState<string | null>(null)
  const [chon, setChon] = useState(gd.goi_y?.[0] ?? '')

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="num text-[1.0625rem] font-semibold text-ink">{vnd(gd.amount)}</div>
          <p className="mt-1 text-[0.8125rem] break-words text-muted">{gd.content}</p>
          <p className="mt-1 text-[0.75rem] text-faint">
            {ngayGioVN(gd.paid_at)}
            {gd.bank_ref && <> · mã NH {gd.bank_ref}</>} · {gd.provider}
          </p>
        </div>
        {gd.goi_y && gd.goi_y.length > 0 && (
          <Pill tone="brand">Có thể là {gd.goi_y.join(', ')}</Pill>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="Gạch vào căn" className="min-w-52 flex-1">
          <Select value={chon} onChange={(e) => setChon(e.target.value)}>
            <option value="">— chọn căn hộ —</option>
            {canHo.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Button
          dang="chinh" disabled={!chon}
          onClick={() => setChon((c) => (setXong(`Bản demo: sẽ gạch ${vnd(gd.amount)} vào ${c}.`), c))}
        >
          Gạch nợ
        </Button>
        <Button dang="nhat" onClick={() => setXong('Bản demo: sẽ đánh dấu bỏ qua (phải ghi lý do).')}>
          Không phải tiền cư dân
        </Button>
      </div>

      {xong && <div className="mt-2"><Hop tone="brand">{xong}</Hop></div>}
    </li>
  )
}
