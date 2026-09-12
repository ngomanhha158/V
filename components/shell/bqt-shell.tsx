import Link from 'next/link'
import type { ReactNode } from 'react'
import { ThemeToggle } from './theme-toggle'
import { NutRa } from './nut-ra'

/**
 * Vỏ màn Ban quản trị.
 *
 * CỐ Ý KHÔNG CÓ THANH BÊN. Ban quản trị không trực ban: họ là người đọc báo
 * cáo, mở vài lần mỗi quý trước kỳ họp. Đưa họ vào thanh điều hướng ba mươi
 * mục của bên vận hành — đối soát tiền về, kho vật tư, xếp ca — là vừa không
 * dùng được vừa sai vai, vì đó chính là bên mà họ có nhiệm vụ giám sát.
 *
 * Rộng hơn màn cư dân (max-w-4xl) vì ở đây là bảng số đem ra họp, không phải
 * dòng thời gian đọc trên điện thoại lúc đứng chờ thang máy.
 */
export function BqtShell({
  children, base = '', khu,
}: {
  children: ReactNode; base?: string; khu?: string | null
}) {
  // Bản demo không có phiên nào để thoát ra — cùng lý do với ResidentShell.
  const laThat = base === ''
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Link href={`${base}/bqt`} className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-[0.8125rem] font-bold text-on-brand">
              VB
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm leading-tight font-semibold text-ink">
                Ban quản trị
              </span>
              <span className="block truncate text-[0.75rem] leading-tight text-faint">
                {khu ?? 'VBuilding'}
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-0.5">
            <Link
              href={base || '/'}
              className="rounded-ctl px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              Màn cư dân
            </Link>
            <ThemeToggle />
            {laThat && <NutRa />}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl grow px-4 py-5">{children}</main>
    </div>
  )
}
