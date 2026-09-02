'use client'

import { useState } from 'react'
import { Button, Hop, Pill, Textarea } from '@/components/ui'
import { ngayGioVN } from '@/lib/ngay'
import { NHAN_TRANG_THAI, phanTram, tongPhieu, trangThai } from '@/lib/tham-do'
import { BINH_LUAN_DEMO, THAM_DO_DEMO, TOI } from '@/lib/demo/data'

// Dùng chung phanTram, trangThai và nhãn với màn thật — phần trăm mà lệch nhau
// giữa hai màn là bản demo dạy sai đúng con số người ta nhìn.
// Không import actions.ts: bản demo không ghi vào database.

export function GopYDemo() {
  const [phieu, setPhieu] = useState<number | null>(null)
  const [dem, setDem] = useState(THAM_DO_DEMO.dem)
  const [binhLuan, setBinhLuan] = useState(BINH_LUAN_DEMO)
  const [nhap, setNhap] = useState('')
  const [mo, setMo] = useState(false)

  const tt = trangThai(THAM_DO_DEMO.kin, THAM_DO_DEMO.dong_luc)
  const pt = phanTram(dem)

  function bo(i: number) {
    setDem((cu) => {
      const moi = [...cu]
      // Một căn một phiếu: bỏ lại là DỜI phiếu, không cộng thêm.
      if (phieu !== null) moi[phieu] -= 1
      moi[i] += 1
      return moi
    })
    setPhieu(i)
  }

  return (
    <>
      <div className="mt-4 rounded-card border border-line bg-raised p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-[0.875rem] font-semibold text-ink">{THAM_DO_DEMO.cau_hoi}</h3>
          <Pill tone="brand" cham={false}>{NHAN_TRANG_THAI[tt]}</Pill>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {THAM_DO_DEMO.lua_chon.map((lc, i) => (
            <Button
              key={i} co="sm" dang={phieu === i ? 'chinh' : 'phu'} onClick={() => bo(i)}
            >
              {lc}{phieu === i ? ' ✓' : ''}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-[0.75rem] text-faint">
          Mỗi <strong className="text-muted">căn hộ</strong> một phiếu — bạn đang bỏ cho căn{' '}
          {TOI.can}. Người khác cùng căn bỏ sau sẽ thay phiếu này, không cộng thêm.
        </p>

        <div className="mt-3 space-y-2">
          {THAM_DO_DEMO.lua_chon.map((lc, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                <span className={phieu === i ? 'font-semibold text-ink' : 'text-muted'}>{lc}</span>
                <span className="num shrink-0 text-muted">
                  {dem[i]} <span className="text-faint">· {pt[i]}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
                <div
                  className={phieu === i ? 'h-full bg-brand' : 'h-full bg-line-firm'}
                  style={{ width: `${pt[i]}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-[0.75rem] text-faint">{tongPhieu(dem)} căn đã bỏ phiếu</p>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.8125rem] font-medium text-muted">{binhLuan.length} ý kiến</span>
          {!mo && <Button co="sm" dang="phu" onClick={() => setMo(true)}>Viết ý kiến</Button>}
        </div>

        <ul className="mt-3 space-y-3">
          {binhLuan.map((c) => (
            <li key={c.id} className="text-[0.8125rem]">
              {c.an_luc ? (
                // Ẩn chứ không xóa: dòng vẫn còn chỗ, nên không ai bị mất tiếng
                // nói một cách lặng lẽ.
                <p className="text-faint italic">Một ý kiến đã được ban quản lý ẩn.</p>
              ) : (
                <>
                  <p className="leading-relaxed whitespace-pre-wrap text-ink">{c.body}</p>
                  <p className="mt-0.5 text-[0.75rem] text-faint">
                    {c.can} · {c.ten} · {ngayGioVN(c.created_at)}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>

        {mo && (
          <div className="mt-3 space-y-2">
            <Textarea
              rows={3} maxLength={2000} placeholder="Ý kiến của bạn về thông báo này…"
              value={nhap} onChange={(e) => setNhap(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                co="sm" dang="chinh" disabled={!nhap.trim()}
                onClick={() => {
                  setBinhLuan((cu) => [...cu, {
                    id: Date.now(), body: nhap.trim(), created_at: new Date().toISOString(),
                    an_luc: null, can: TOI.can, ten: TOI.ho_ten,
                  }])
                  setNhap(''); setMo(false)
                }}
              >
                Gửi ý kiến
              </Button>
              <Button co="sm" dang="nhat" onClick={() => setMo(false)}>Hủy</Button>
              <span className="text-[0.75rem] text-faint">Gửi rồi thì không sửa lại được</span>
            </div>
          </div>
        )}
      </div>

      <Hop tone="trung" className="mt-4">
        Bỏ phiếu và viết ý kiến ở đây chạy thật — trong bộ nhớ trình duyệt, không lưu gì.
        Thử bấm sang lựa chọn khác: tổng phiếu <strong>không tăng</strong>, vì một căn chỉ có
        một phiếu và bỏ lại là dời phiếu chứ không cộng thêm.
      </Hop>
    </>
  )
}
