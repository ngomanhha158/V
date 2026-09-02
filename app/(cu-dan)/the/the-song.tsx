'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Hop } from '@/components/ui'

/**
 * Ô mã QR tự làm mới.
 *
 * Xin mã mới ở giây thứ 40 của một mã sống 60 giây, chứ không xin đúng lúc hết
 * hạn: mạng ở hầm gửi xe chậm, và một mã vừa chết trên màn hình đúng lúc bảo
 * vệ đưa máy lên quét là phải làm lại từ đầu trước mặt hàng người đang chờ.
 */
const XIN_LAI_MS = 40_000

export function TheSong({ unit }: { unit: string }) {
  const [anh, setAnh] = useState<string | null>(null)
  const [loi, setLoi] = useState<string | null>(null)
  const dangChay = useRef(false)

  const xin = useCallback(async () => {
    if (dangChay.current) return
    dangChay.current = true
    try {
      const r = await fetch(`/api/the?unit=${encodeURIComponent(unit)}`, { cache: 'no-store' })
      const j = (await r.json()) as { anh?: string; loi?: string }
      if (!r.ok || !j.anh) { setLoi(j.loi ?? 'Không lấy được mã.'); return }
      setAnh(j.anh); setLoi(null)
    } catch {
      // Mất mạng giữa chừng: GIỮ mã cũ trên màn hình thay vì xóa trắng. Nó có
      // thể vẫn còn hạn, mà nếu hết hạn thì bảo vệ đọc được lý do trên máy họ.
      setLoi('Mất kết nối — mã trên màn hình có thể đã cũ.')
    } finally {
      dangChay.current = false
    }
  }, [unit])

  useEffect(() => {
    xin()
    const h = setInterval(xin, XIN_LAI_MS)
    // Điện thoại khóa màn hình thì trình duyệt dừng hết timer. Mở lại là mã đã
    // chết mà đồng hồ thì tưởng chưa tới lượt — xin lại ngay khi tab sáng lại.
    const khiHien = () => { if (document.visibilityState === 'visible') xin() }
    document.addEventListener('visibilitychange', khiHien)
    return () => { clearInterval(h); document.removeEventListener('visibilitychange', khiHien) }
  }, [xin])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid aspect-square w-full max-w-[17rem] place-items-center rounded-card border border-line bg-white p-3">
        {anh
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={anh} alt="Mã thẻ cư dân" className="size-full" />
          : <span className="text-[0.75rem] text-faint">Đang lấy mã…</span>}
      </div>
      <p className="text-center text-[0.75rem] text-faint">
        Mã tự đổi. Đưa màn hình cho bảo vệ quét — vặn sáng màn hình lên nếu
        sảnh tối.
      </p>
      {loi && <Hop tone="canh">{loi}</Hop>}
    </div>
  )
}
