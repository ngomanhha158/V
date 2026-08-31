'use client'
import { useEffect, useState } from 'react'
import { IcSang, IcToi } from '@/components/icons'

type Che = 'light' | 'dark'

/**
 * Đổi sáng/tối. BQL ngồi phòng kỹ thuật thiếu sáng cả ngày, nền trắng chói là
 * lý do người ta bỏ dùng phần mềm chứ không phải chuyện thẩm mỹ.
 *
 * Lựa chọn ghi vào localStorage và được script chặn-nháy trong layout đọc lại
 * TRƯỚC khi trang vẽ, nếu không mỗi lần tải trang sẽ loé trắng một nhịp.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [che, setChe] = useState<Che | null>(null)

  useEffect(() => {
    const luu = localStorage.getItem('vb-theme')
    if (luu === 'light' || luu === 'dark') return setChe(luu)
    setChe(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  }, [])

  function doi() {
    const moi: Che = che === 'dark' ? 'light' : 'dark'
    setChe(moi)
    document.documentElement.dataset.theme = moi
    try { localStorage.setItem('vb-theme', moi) } catch { /* chế độ riêng tư */ }
  }

  return (
    <button
      onClick={doi}
      // Chưa biết chế độ (lần vẽ đầu trên server) thì giữ chỗ để nút không nhảy.
      aria-label={che === 'dark' ? 'Chuyển nền sáng' : 'Chuyển nền tối'}
      className={
        'inline-flex size-9 items-center justify-center rounded-ctl text-muted ' +
        'transition-colors hover:bg-sunken hover:text-ink ' + (className ?? '')
      }
    >
      {che === 'dark' ? <IcSang /> : <IcToi />}
    </button>
  )
}
