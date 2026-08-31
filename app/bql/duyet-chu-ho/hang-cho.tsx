'use client'

import { useActionState } from 'react'
import { Button, Hop, ngayGioVN } from '@/components/ui'
import { duyetChuHo, type DuyetState } from './actions'

export type YeuCau = {
  membership_id: string
  unit_code: string
  building_code: string
  ho_ten: string
  dien_thoai: string | null
  email: string | null
  xin_luc: string
}

const dauTien = { error: undefined, ok: undefined } satisfies DuyetState

function Dong({ y }: { y: YeuCau }) {
  const [s, act, dang] = useActionState(duyetChuHo, dauTien)

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.9375rem] font-semibold text-ink">
            {y.building_code}-{y.unit_code.replace(`${y.building_code}-`, '')} · {y.ho_ten}
          </div>
          {/* SĐT và email hiện ra để đối chiếu với hợp đồng mua bán. Đây là lý
              do duy nhất màn này được thấy chúng — đừng thêm cột gì khác. */}
          <p className="num mt-1 text-[0.8125rem] text-muted">
            {y.dien_thoai ?? <span className="text-faint">chưa có SĐT</span>}
            {y.email && <> · {y.email}</>}
          </p>
          <p className="mt-1 text-[0.75rem] text-faint">Xin lúc {ngayGioVN(y.xin_luc)}</p>
        </div>
        <form action={act}>
          <input type="hidden" name="membership" value={y.membership_id} />
          <input type="hidden" name="ten" value={y.ho_ten} />
          <input type="hidden" name="can" value={y.unit_code} />
          <Button dang="chinh" type="submit" disabled={dang}>
            {dang ? 'Đang duyệt…' : 'Duyệt làm chủ hộ'}
          </Button>
        </form>
      </div>
      {s.error && <div className="mt-2"><Hop tone="xau">{s.error}</Hop></div>}
      {s.ok && <div className="mt-2"><Hop tone="tot">{s.ok}</Hop></div>}
    </li>
  )
}

export function HangCho({ ds }: { ds: YeuCau[] }) {
  return (
    <ul className="divide-y divide-line">
      {ds.map((y) => <Dong key={y.membership_id} y={y} />)}
    </ul>
  )
}
