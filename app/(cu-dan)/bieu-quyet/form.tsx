'use client'

import { useActionState } from 'react'
import { Button, Hop, cx } from '@/components/ui'
import { GIAI_THICH_Y_KIEN, NHAN_Y_KIEN, Y_KIEN, m2 } from '@/lib/bieu-quyet'
import { boPhieu, type PhieuState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies PhieuState

/**
 * Lá phiếu của MỘT căn.
 *
 * Ba nút riêng biệt chứ không phải một ô chọn rồi bấm gửi: người bỏ phiếu trên
 * điện thoại ở hành lang, và mỗi bước thừa là một người bỏ dở. Nhưng mỗi nút
 * kèm một dòng giải thích — nhất là phiếu trắng, thứ ai cũng tưởng là "không
 * bỏ phiếu".
 */
export function LaPhieu({ bq, unit, maCan, dienTich }: {
  bq: string; unit: string; maCan: string; dienTich: number
}) {
  const [state, action, dangChay] = useActionState(boPhieu, dauTien)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bq" value={bq} />
      <input type="hidden" name="unit" value={unit} />
      <div className="text-[0.8125rem] text-muted">
        Phiếu của căn <span className="num font-medium text-ink">{maCan}</span> có trọng số{' '}
        <span className="num font-medium text-ink">{m2(dienTich)}</span>.
      </div>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="space-y-2">
        {Y_KIEN.map((y) => (
          <div key={y} className="rounded-card border border-line bg-surface p-3">
            <Button
              type="submit"
              name="y_kien"
              value={y}
              disabled={dangChay}
              dang={y === 'tan_thanh' ? 'chinh' : 'phu'}
              className={cx('w-full', y === 'khong_tan_thanh' && 'border-bad-line text-bad')}
            >
              {dangChay ? 'Đang gửi…' : NHAN_Y_KIEN[y]}
            </Button>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
              {GIAI_THICH_Y_KIEN[y]}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[0.75rem] leading-relaxed text-faint">
        Bấm là ghi ngay, và phiếu KHÔNG sửa được. Bỏ nhầm thì nhờ ban quản trị
        hủy phiếu — họ phải ghi lý do, và tên họ nằm lại trong sổ.
      </p>
    </form>
  )
}
