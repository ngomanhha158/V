'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Pill, Select, cx, ngayGioVN, vnd } from '@/components/ui'
import { boQuaGiaoDich, ganGiaoDich, type DoiSoatState } from './actions'

export type GiaoDich = {
  id: string
  provider: string
  bank_ref: string | null
  amount: number
  content: string
  paid_at: string
  trang_thai: string
  cach_khop: string | null
  con_du: number
  unit_code: string | null
  ghi_chu: string | null
  goi_y: string[] | null
}
export type CanHo = { id: string; code: string }

const dauTien = { error: undefined, ok: undefined } satisfies DoiSoatState

/**
 * Một dòng trong hàng đợi đối soát. Mỗi dòng có form riêng chứ không phải một
 * form chung cho cả bảng: BQL xử lý từng giao dịch một, và một lỗi ở dòng này
 * không được xóa những gì đã gõ ở dòng khác.
 */
function Dong({ gd, canHo }: { gd: GiaoDich; canHo: CanHo[] }) {
  const [moBoQua, setMoBoQua] = useState(false)
  const [sGan, actGan, dangGan] = useActionState(ganGiaoDich, dauTien)
  const [sBo, actBo, dangBo] = useActionState(boQuaGiaoDich, dauTien)

  // Gợi ý đầu tiên làm giá trị mặc định của ô chọn — BQL vẫn phải bấm xác nhận.
  // Dò lỏng chỉ đủ tin để ĐIỀN SẴN, không đủ tin để tự gạch.
  const goiYDau = gd.goi_y?.[0]
  const mac = canHo.find((c) => c.code === goiYDau)?.id ?? ''

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="num text-[1.0625rem] font-semibold text-ink">{vnd(gd.amount)}</div>
          <p className="mt-1 text-[0.8125rem] break-words text-muted">
            {gd.content || <span className="text-faint">(không có nội dung)</span>}
          </p>
          <p className="mt-1 text-[0.75rem] text-faint">
            {ngayGioVN(gd.paid_at)}
            {gd.bank_ref && <> · mã NH {gd.bank_ref}</>} · {gd.provider}
          </p>
        </div>
        {gd.goi_y && gd.goi_y.length > 0 && (
          <Pill tone="brand">Có thể là {gd.goi_y.join(', ')}</Pill>
        )}
      </div>

      <form action={actGan} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="txn" value={gd.id} />
        <Field label="Gạch vào căn" className="min-w-52 flex-1">
          <Select name="unit" defaultValue={mac} required>
            <option value="">— chọn căn hộ —</option>
            {canHo.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </Select>
        </Field>
        <Button dang="chinh" type="submit" disabled={dangGan || dangBo}>
          {dangGan ? 'Đang gạch…' : 'Gạch nợ'}
        </Button>
        <Button
          type="button" dang="nhat" disabled={dangGan || dangBo}
          onClick={() => setMoBoQua((v) => !v)}
        >
          {moBoQua ? 'Thôi' : 'Không phải tiền cư dân'}
        </Button>
      </form>

      {moBoQua && (
        <form action={actBo} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="txn" value={gd.id} />
          <Field
            label="Lý do bỏ qua" className="min-w-64 flex-1"
            hint="Bắt buộc — cuối năm đối soát lại còn dựng được vì sao nó biến mất khỏi danh sách"
          >
            <Input name="ghi_chu" required placeholder="Hoàn tiền nhà thầu, chuyển nhầm…" />
          </Field>
          <Button dang="nguy" type="submit" disabled={dangBo}>
            {dangBo ? 'Đang lưu…' : 'Bỏ qua'}
          </Button>
        </form>
      )}

      {(sGan.error || sBo.error) && (
        <div className="mt-2"><Hop tone="xau">{sGan.error ?? sBo.error}</Hop></div>
      )}
      {(sGan.ok || sBo.ok) && (
        <div className="mt-2"><Hop tone="tot">{sGan.ok ?? sBo.ok}</Hop></div>
      )}
    </li>
  )
}

export function HangDoi({ ds, canHo }: { ds: GiaoDich[]; canHo: CanHo[] }) {
  return (
    <ul className={cx('divide-y divide-line')}>
      {ds.map((gd) => <Dong key={gd.id} gd={gd} canHo={canHo} />)}
    </ul>
  )
}
