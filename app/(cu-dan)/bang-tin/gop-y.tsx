'use client'

import { useActionState, useState } from 'react'
import { Button, Hop, Pill, Textarea } from '@/components/ui'
import { ngayGioVN } from '@/lib/ngay'
import {
  demTheoLuaChon, NHAN_TRANG_THAI, phanTram, tongPhieu, trangThai, type KetQua,
} from '@/lib/tham-do'
import { boPhieu, vietBinhLuan, type GopYState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies GopYState

export type ThamDo = {
  announcement_id: string
  cau_hoi: string
  lua_chon: string[]
  kin: boolean
  dong_luc: string | null
}

export type BinhLuan = {
  id: number
  body: string
  created_at: string
  an_luc: string | null
  ten: string | null
  can: string | null
}

export function KhoiThamDo({
  td, ketQua, phieuCuaToi, unitId, tenCan,
}: {
  td: ThamDo
  ketQua: KetQua[]
  phieuCuaToi: number | null
  unitId: string | null
  tenCan: string | null
}) {
  const [state, formAction, dangChay] = useActionState(boPhieu, dauTien)
  const tt = trangThai(td.kin, td.dong_luc)
  const dem = demTheoLuaChon(ketQua, td.lua_chon.length)
  const tong = tongPhieu(dem)
  const pt = phanTram(dem)
  // Cuộc kín chưa đóng: hàm SQL trả về mảng rỗng cho cư dân. Hiện "chờ công bố"
  // chứ KHÔNG hiện 0 phiếu — 0 là một con số sai, không phải một lời từ chối.
  const giauKetQua = tt === 'kin_chua_dong' && ketQua.length === 0
  const dongRoi = tt === 'da_dong'

  return (
    <div className="mt-4 rounded-card border border-line bg-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-[0.875rem] font-semibold text-ink">{td.cau_hoi}</h3>
        <Pill tone={dongRoi ? 'trung' : td.kin ? 'canh' : 'brand'} cham={false}>
          {NHAN_TRANG_THAI[tt]}
        </Pill>
      </div>

      {!unitId ? (
        <p className="mt-3 text-[0.8125rem] text-muted">
          Bạn chưa được duyệt là thành viên của căn hộ nào, nên chưa bỏ phiếu được.
        </p>
      ) : dongRoi ? (
        <p className="mt-3 text-[0.75rem] text-faint">Cuộc thăm dò đã đóng.</p>
      ) : (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="poll" value={td.announcement_id} />
          <input type="hidden" name="unit" value={unitId} />
          <div className="flex flex-wrap gap-2">
            {td.lua_chon.map((lc, i) => (
              <Button
                key={i} type="submit" name="chon" value={i} co="sm" disabled={dangChay}
                dang={phieuCuaToi === i ? 'chinh' : 'phu'}
              >
                {lc}{phieuCuaToi === i ? ' ✓' : ''}
              </Button>
            ))}
          </div>
          <p className="text-[0.75rem] text-faint">
            {/* Nói rõ ngay chỗ bỏ phiếu, không giấu trong phần trợ giúp: đây là
                điều hay bị hiểu nhầm nhất, và hiểu nhầm thì cả nhà cùng bấm. */}
            Mỗi <strong className="text-muted">căn hộ</strong> một phiếu
            {tenCan && ` — bạn đang bỏ cho căn ${tenCan}`}. Người khác cùng căn bỏ sau sẽ
            thay phiếu này, không cộng thêm.
          </p>
        </form>
      )}

      {state.error && <div className="mt-2"><Hop tone="xau">{state.error}</Hop></div>}
      {state.ok && <div className="mt-2"><Hop tone="tot">{state.ok}</Hop></div>}

      {giauKetQua ? (
        <p className="mt-3 text-[0.8125rem] text-muted">
          Kết quả công bố khi cuộc thăm dò đóng — để người bỏ phiếu sau không bị số đang
          chạy kéo theo.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {td.lua_chon.map((lc, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                <span className={phieuCuaToi === i ? 'font-semibold text-ink' : 'text-muted'}>
                  {lc}
                </span>
                <span className="num shrink-0 text-muted">
                  {dem[i]} <span className="text-faint">· {pt[i]}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
                <div
                  className={phieuCuaToi === i ? 'h-full bg-brand' : 'h-full bg-line-firm'}
                  style={{ width: `${pt[i]}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-[0.75rem] text-faint">{tong} căn đã bỏ phiếu</p>
        </div>
      )}
    </div>
  )
}

export function KhoiBinhLuan({
  tb, ds, unitId,
}: { tb: string; ds: BinhLuan[]; unitId: string | null }) {
  const [state, formAction, dangChay] = useActionState(vietBinhLuan, dauTien)
  const [mo, setMo] = useState(false)

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] font-medium text-muted">
          {ds.length === 0 ? 'Chưa có ý kiến nào' : `${ds.length} ý kiến`}
        </span>
        {unitId && !mo && (
          <Button co="sm" dang="phu" onClick={() => setMo(true)}>Viết ý kiến</Button>
        )}
      </div>

      {ds.length > 0 && (
        <ul className="mt-3 space-y-3">
          {ds.map((c) => (
            <li key={c.id} className="text-[0.8125rem]">
              {c.an_luc ? (
                // Ẩn chứ không xóa: dòng vẫn còn chỗ, nên không ai bị mất tiếng
                // nói một cách lặng lẽ.
                <p className="text-faint italic">
                  Một ý kiến đã được ban quản lý ẩn.
                </p>
              ) : (
                <>
                  <p className="leading-relaxed whitespace-pre-wrap text-ink">{c.body}</p>
                  <p className="mt-0.5 text-[0.75rem] text-faint">
                    {c.can ?? 'Cư dân'}
                    {c.ten && ` · ${c.ten}`}
                    {' · '}{ngayGioVN(c.created_at)}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {mo && unitId && (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="tb" value={tb} />
          <input type="hidden" name="unit" value={unitId} />
          <Textarea
            name="body" rows={3} required maxLength={2000}
            placeholder="Ý kiến của bạn về thông báo này…"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" co="sm" dang="chinh" disabled={dangChay}>
              {dangChay ? 'Đang gửi…' : 'Gửi ý kiến'}
            </Button>
            <Button type="button" co="sm" dang="nhat" onClick={() => setMo(false)}>Hủy</Button>
            <span className="text-[0.75rem] text-faint">Gửi rồi thì không sửa lại được</span>
          </div>
        </form>
      )}

      {state.error && <div className="mt-2"><Hop tone="xau">{state.error}</Hop></div>}
      {state.ok && <div className="mt-2"><Hop tone="tot">{state.ok}</Hop></div>}
    </div>
  )
}
