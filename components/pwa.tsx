'use client'

import { useEffect, useState } from 'react'
import { Button, cx } from './ui'

/** Đăng ký service worker. Không render gì. */
export function DangKySW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Đăng ký sau khi trang tải xong: chen vào lúc đang tải làm chậm lần mở đầu,
    // mà lần mở đầu chính là lúc cư dân quyết định app này có dùng được không.
    const dangKy = () => navigator.serviceWorker.register('/sw.js').catch(() => {
      // Thất bại thì thôi. Service worker là phần thêm, không có nó app vẫn chạy.
    })
    if (document.readyState === 'complete') dangKy()
    else {
      window.addEventListener('load', dangKy)
      return () => window.removeEventListener('load', dangKy)
    }
  }, [])
  return null
}

type SuKienCai = Event & { prompt: () => Promise<void> }

const KHOA_AN = 'vb-an-goi-y-cai'
const laIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPad từ iPadOS 13 khai userAgent giống máy Mac. Phân biệt bằng cảm ứng.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * Gợi ý cài app vào màn hình chính.
 *
 * Hai đường hoàn toàn khác nhau, không gộp được:
 *  - Android/Chrome bắn sự kiện beforeinstallprompt -> hiện đúng một nút bấm.
 *  - iOS Safari KHÔNG có sự kiện nào. Bắt buộc phải chỉ đường bằng lời, và
 *    đây lại là nền tảng cần cài nhất: iOS chỉ gửi thông báo đẩy cho web app
 *    đã Add to Home Screen.
 */
export function GoiYCaiApp({ className }: { className?: string }) {
  const [suKien, setSuKien] = useState<SuKienCai | null>(null)
  const [hienIOS, setHienIOS] = useState(false)
  const [an, setAn] = useState(true)

  useEffect(() => {
    // Đã cài rồi thì không gợi ý nữa. display-mode: standalone là cách chuẩn;
    // navigator.standalone là cách riêng của iOS Safari cũ.
    const daCai = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as { standalone?: boolean }).standalone === true
    let daTat = false
    try { daTat = localStorage.getItem(KHOA_AN) === '1' } catch { /* chế độ riêng tư */ }
    if (daCai || daTat) return

    setAn(false)
    if (laIOS()) setHienIOS(true)

    const bat = (e: Event) => { e.preventDefault(); setSuKien(e as SuKienCai) }
    window.addEventListener('beforeinstallprompt', bat)
    return () => window.removeEventListener('beforeinstallprompt', bat)
  }, [])

  function tat() {
    setAn(true)
    try { localStorage.setItem(KHOA_AN, '1') } catch { /* không sao */ }
  }

  if (an || (!suKien && !hienIOS)) return null

  return (
    <div
      className={cx(
        'rounded-card border border-brand-line bg-brand-soft px-4 py-3.5',
        'text-[0.8125rem] text-brand-deep',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">Cài VBuilding vào màn hình chính</p>
          <p className="mt-1 leading-relaxed">
            {suKien
              ? 'Mở nhanh như một ứng dụng, không phải nhớ địa chỉ web.'
              : 'Bấm nút Chia sẻ ở thanh dưới của Safari, kéo xuống chọn “Thêm vào MH chính”. Cài rồi mới nhận được thông báo của ban quản lý.'}
          </p>
        </div>
        <button
          onClick={tat}
          aria-label="Ẩn gợi ý"
          className="-mt-1 -mr-1 shrink-0 rounded p-1 text-lg leading-none opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
      {suKien && (
        <Button
          dang="chinh" co="sm" className="mt-3"
          onClick={async () => { await suKien.prompt(); tat() }}
        >
          Cài đặt
        </Button>
      )}
    </div>
  )
}
