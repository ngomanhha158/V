import Link from 'next/link'
import type { ReactNode } from 'react'
import { NavTab } from './nav-link'
import { ThemeToggle } from './theme-toggle'
import { IcChuong, IcHoaDon, IcNguoi, IcNha, IcYeuCau } from '@/components/icons'

/**
 * Vỏ màn cư dân. Điện thoại là thiết bị chính — người ta báo sự cố lúc đang
 * đứng nhìn vũng nước, không phải lúc ngồi trước máy tính. Nên điều hướng nằm
 * ở thanh dưới, trong tầm ngón cái.
 *
 * `base` cho phép bản demo dùng lại đúng vỏ này với tiền tố /demo, khỏi phải
 * chép ra bản thứ hai rồi để hai bản lệch nhau dần.
 */
export function ResidentShell({
  children, base = '', ten, phu, soThongBao = 0,
}: {
  children: ReactNode; base?: string
  ten?: string; phu?: string; soThongBao?: number
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Link href={base || '/'} className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-[0.8125rem] font-bold text-on-brand">
              VB
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm leading-tight font-semibold text-ink">
                {ten ?? 'VBuilding'}
              </span>
              {phu && <span className="block truncate text-[0.75rem] leading-tight text-faint">{phu}</span>}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              aria-label={`Thông báo${soThongBao ? ` (${soThongBao} chưa đọc)` : ''}`}
              className="relative inline-flex size-9 items-center justify-center rounded-ctl text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <IcChuong />
              {soThongBao > 0 && (
                <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-bad text-[0.625rem] font-bold text-white">
                  {soThongBao > 9 ? '9+' : soThongBao}
                </span>
              )}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* pb-24: chừa chỗ cho thanh tab cố định, nếu không nội dung cuối trang
          bị thanh đè lên và không cuộn tới được. */}
      <main className="mx-auto w-full max-w-2xl grow px-4 py-5 pb-24 sm:pb-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-md sm:hidden">
        {/* pb an toàn cho vạch home của iPhone. */}
        <div className="mx-auto flex max-w-2xl pb-[env(safe-area-inset-bottom)]">
          <NavTab href={base || '/'} icon={<IcNha />} chinhXac>Trang chủ</NavTab>
          <NavTab href={`${base}/invoices`} icon={<IcHoaDon />}>Hóa đơn</NavTab>
          <NavTab href={`${base}/tickets`} icon={<IcYeuCau />}>Yêu cầu</NavTab>
          <NavTab href={`${base}/approvals`} icon={<IcNguoi />}>Thành viên</NavTab>
        </div>
      </nav>
    </div>
  )
}
