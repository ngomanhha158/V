'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Pill, Textarea } from '@/components/ui'
import { ngayGioVN } from '@/lib/ngay'
import { demTheoLuaChon, NHAN_TRANG_THAI, phanTram, tongPhieu, trangThai } from '@/lib/tham-do'
import { doiAnBinhLuan, themThamDo, type GopYState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies GopYState

export type ThamDoBQL = {
  announcement_id: string
  cau_hoi: string
  lua_chon: string[]
  kin: boolean
  dong_luc: string | null
  dem: number[]
}

export type BinhLuanBQL = {
  id: number
  body: string
  created_at: string
  an_luc: string | null
  an_ly_do: string | null
  can: string | null
  ten: string | null
}

export function FormThamDo({ tb }: { tb: string }) {
  const [state, formAction, dangChay] = useActionState(themThamDo, dauTien)
  const [mo, setMo] = useState(false)

  if (state.ok) return <Hop tone="tot" title="Xong">{state.ok}</Hop>
  if (!mo) {
    return <Button co="sm" dang="phu" onClick={() => setMo(true)}>Thêm thăm dò</Button>
  }

  return (
    <form action={formAction} className="mt-2 space-y-3 rounded-card border border-line bg-raised p-3">
      <input type="hidden" name="tb" value={tb} />
      <Field label="Câu hỏi">
        <Input name="cau_hoi" required placeholder="Có nên lắp thêm camera hầm B2?" />
      </Field>
      <Field label="Lựa chọn" hint="Mỗi dòng một lựa chọn, từ 2 tới 8">
        <Textarea name="lua_chon" rows={3} required defaultValue={'Đồng ý\nKhông'} />
      </Field>
      <Field label="Đóng lúc" hint="Để trống nếu mở vô thời hạn">
        <Input type="datetime-local" name="dong_luc" className="num" />
      </Field>
      <label className="flex items-start gap-2 text-[0.8125rem] text-muted">
        <input type="checkbox" name="kin" value="1" className="mt-0.5 size-4 shrink-0 accent-brand" />
        <span>
          <strong className="text-ink">Giấu kết quả tới khi đóng.</strong> Hiện số đang chạy
          làm người bỏ sau nghiêng theo số đông; giấu thì mất minh bạch. Không có lựa chọn
          nào đúng cho mọi câu hỏi, nên để bạn quyết.
        </span>
      </label>
      {state.error && <Hop tone="xau" title="Không tạo được">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="chinh" disabled={dangChay}>
          {dangChay ? 'Đang tạo…' : 'Tạo thăm dò'}
        </Button>
        <Button type="button" co="sm" dang="nhat" onClick={() => setMo(false)}>Hủy</Button>
      </div>
    </form>
  )
}

export function KetQuaBQL({ td }: { td: ThamDoBQL }) {
  const tt = trangThai(td.kin, td.dong_luc)
  const dem = demTheoLuaChon(td.dem.map((n, i) => ({ chon: i, so_phieu: n })), td.lua_chon.length)
  const pt = phanTram(dem)

  return (
    <div className="mt-2 rounded-card border border-line bg-raised p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-[0.8125rem] font-semibold text-ink">{td.cau_hoi}</span>
        <Pill tone={tt === 'da_dong' ? 'trung' : td.kin ? 'canh' : 'brand'} cham={false}>
          {NHAN_TRANG_THAI[tt]}
        </Pill>
      </div>
      <div className="mt-2 space-y-1.5">
        {td.lua_chon.map((lc, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
              <span className="text-muted">{lc}</span>
              <span className="num shrink-0 text-muted">
                {dem[i]} <span className="text-faint">· {pt[i]}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
              <div className="h-full bg-line-firm" style={{ width: `${pt[i]}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.75rem] text-faint">
        {tongPhieu(dem)} căn đã bỏ phiếu · một căn một phiếu
        {td.kin && ' · cư dân chưa thấy số này'}
      </p>
    </div>
  )
}

export function HangBinhLuan({ c }: { c: BinhLuanBQL }) {
  const [state, formAction, dangChay] = useActionState(doiAnBinhLuan, dauTien)
  const [mo, setMo] = useState(false)
  const daAn = c.an_luc !== null

  return (
    <li className="py-2.5 text-[0.8125rem]">
      <p className={daAn ? 'text-faint line-through' : 'text-ink'}>{c.body}</p>
      <p className="mt-0.5 text-[0.75rem] text-faint">
        {c.can ?? 'Cư dân'}{c.ten && ` · ${c.ten}`} · {ngayGioVN(c.created_at)}
        {daAn && c.an_ly_do && ` · đã ẩn: ${c.an_ly_do}`}
      </p>

      {daAn ? (
        <form action={formAction} className="mt-1.5">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="an" value="0" />
          <Button type="submit" co="sm" dang="nhat" disabled={dangChay}>Hiện lại</Button>
        </form>
      ) : !mo ? (
        <Button co="sm" dang="nhat" className="mt-1.5" onClick={() => setMo(true)}>Ẩn</Button>
      ) : (
        <form action={formAction} className="mt-1.5 flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="an" value="1" />
          <div className="w-56">
            <Input name="ly_do" required placeholder="Lý do ẩn" className="h-9" />
          </div>
          <Button type="submit" co="sm" dang="nguy" disabled={dangChay}>Ẩn</Button>
          <Button type="button" co="sm" dang="nhat" onClick={() => setMo(false)}>Hủy</Button>
        </form>
      )}

      {state.error && <div className="mt-1.5"><Hop tone="xau">{state.error}</Hop></div>}
      {state.ok && <div className="mt-1.5"><Hop tone="tot">{state.ok}</Hop></div>}

      <p className="mt-1.5 text-[0.75rem] text-faint">
        {daAn ? 'Đang ẩn khỏi màn cư dân — dòng vẫn còn trong hệ thống.' : null}
      </p>
    </li>
  )
}
