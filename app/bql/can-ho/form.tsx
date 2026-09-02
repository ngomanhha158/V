'use client'

import { useActionState, useState } from 'react'
import { Button, Hop, Input } from '@/components/ui'
import { soM2 } from '@/lib/can-ho'
import { apHangLoat, datDienTich, type CanHoState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies CanHoState

/**
 * Ô diện tích của một căn.
 *
 * Nút Lưu chỉ sáng khi giá trị khác cái đang lưu — nhìn vào bảng là biết ngay
 * dòng nào mình vừa sửa mà chưa ghi, thay vì 100 nút sáng giống hệt nhau.
 */
export function ODienTich({
  id, ma, dienTich,
}: { id: string; ma: string; dienTich: number | null }) {
  const goc = dienTich === null ? '' : soM2(dienTich)
  const [v, setV] = useState(goc)
  const [state, formAction, dangChay] = useActionState(datDienTich, dauTien)
  const doi = v.trim() !== goc

  return (
    <form action={formAction} className="flex items-start gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ma" value={ma} />
      <div className="w-24 shrink-0">
        <Input
          name="dien_tich" inputMode="decimal" placeholder="—"
          aria-label={`Diện tích căn ${ma}`}
          className="num h-9 text-right"
          value={v} onChange={(e) => setV(e.target.value)} disabled={dangChay}
        />
        {state.error && (
          <span className="mt-1 block text-[0.75rem] leading-snug text-bad">{state.error}</span>
        )}
      </div>
      <Button type="submit" co="sm" dang={doi ? 'chinh' : 'nhat'} disabled={!doi || dangChay}>
        {dangChay ? '…' : 'Lưu'}
      </Button>
    </form>
  )
}

/**
 * Áp một diện tích cho cả tập đang lọc.
 *
 * Các ô ẩn chép nguyên bộ lọc của trang sang cho hành động, để cái nó sửa đúng
 * bằng cái người ta đang nhìn. Số căn ghi thẳng lên nút: bấm một nút ghi "áp
 * cho 468 căn" là một quyết định khác hẳn bấm nút ghi "áp".
 */
export function FormHangLoat({
  soCan, pham, toa, tang, ma, thieu, soDaCo,
}: {
  soCan: number; pham: string
  toa: string; tang: string; ma: string; thieu: string
  soDaCo: number
}) {
  const [state, formAction, dangChay] = useActionState(apHangLoat, dauTien)
  const [ghiDe, setGhiDe] = useState(false)
  const soSeSua = ghiDe ? soCan : soCan - soDaCo

  return (
    <form action={formAction} className="space-y-3 p-4">
      <input type="hidden" name="toa" value={toa} />
      <input type="hidden" name="tang" value={tang} />
      <input type="hidden" name="ma" value={ma} />
      <input type="hidden" name="thieu" value={thieu} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-32 shrink-0">
          <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Diện tích</span>
          <Input
            name="dien_tich" required inputMode="decimal" placeholder="78,5"
            aria-label="Diện tích áp hàng loạt" className="num text-right"
          />
        </div>
        <Button type="submit" dang="chinh" disabled={dangChay || soSeSua <= 0}>
          {dangChay ? 'Đang áp…' : `Áp cho ${soSeSua} căn`}
        </Button>
      </div>

      <label className="flex items-start gap-2 text-[0.8125rem] text-muted">
        <input
          type="checkbox" name="ghi_de" value="1" className="mt-0.5 size-4 shrink-0 accent-brand"
          checked={ghiDe} onChange={(e) => setGhiDe(e.target.checked)}
        />
        <span>
          Ghi đè cả căn đã có diện tích.
          {soDaCo > 0 && (
            <> Trong tập đang lọc có <strong className="text-ink">{soDaCo} căn</strong> đã có
              diện tích; không tick thì chúng giữ nguyên.</>
          )}
        </span>
      </label>

      <p className="text-[0.75rem] text-faint">
        Áp cho: <strong className="text-muted">{pham}</strong>. Đổi bộ lọc bên trên là đổi
        luôn tập này.
      </p>

      {state.error && <Hop tone="xau" title="Không áp được">{state.error}</Hop>}
      {state.ok && <Hop tone="tot" title="Xong">{state.ok}</Hop>}
    </form>
  )
}
