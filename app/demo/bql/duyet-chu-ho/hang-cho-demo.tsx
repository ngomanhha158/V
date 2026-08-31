'use client'

import { useState } from 'react'
import { Button, Hop, ngayGioVN } from '@/components/ui'
import type { YeuCauChuHo } from '@/lib/demo/data'

export function HangChoDemo({ ds }: { ds: YeuCauChuHo[] }) {
  return (
    <ul className="divide-y divide-line">
      {ds.map((y) => <Dong key={y.membership_id} y={y} />)}
    </ul>
  )
}

function Dong({ y }: { y: YeuCauChuHo }) {
  const [xong, setXong] = useState(false)
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.9375rem] font-semibold text-ink">
            {y.unit_code} · {y.ho_ten}
          </div>
          <p className="num mt-1 text-[0.8125rem] text-muted">
            {y.dien_thoai ?? <span className="text-faint">chưa có SĐT</span>}
            {y.email && <> · {y.email}</>}
          </p>
          <p className="mt-1 text-[0.75rem] text-faint">Xin lúc {ngayGioVN(y.xin_luc)}</p>
        </div>
        <Button dang="chinh" disabled={xong} onClick={() => setXong(true)}>
          {xong ? 'Đã duyệt' : 'Duyệt làm chủ hộ'}
        </Button>
      </div>
      {xong && (
        <div className="mt-2">
          <Hop tone="brand">Bản demo: sẽ duyệt {y.ho_ten} làm chủ hộ căn {y.unit_code}.</Hop>
        </div>
      )}
    </li>
  )
}
