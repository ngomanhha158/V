'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cx } from '@/components/ui'

/**
 * Đang-ở-đâu tính bằng so khớp đường dẫn, KHÔNG phải prop truyền tay từ từng
 * trang — làm thế thì sớm muộn cũng có trang quên truyền và thanh điều hướng
 * chỉ sai chỗ.
 *
 * `chinhXac` cho mục gốc (/bql) vì nếu không thì nó sáng ở cả /bql/cong-no.
 */
export function dangO(path: string, href: string, chinhXac?: boolean) {
  return chinhXac ? path === href : path === href || path.startsWith(href + '/')
}

export function NavDoc({
  href, icon, chinhXac, children,
}: { href: string; icon: ReactNode; chinhXac?: boolean; children: ReactNode }) {
  const path = usePathname()
  const on = dangO(path, href, chinhXac)
  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={cx(
        // shrink-0 + nowrap: trên điện thoại thanh này cuộn ngang, thiếu hai
        // cái đó thì các mục bị bóp lại cho vừa màn hình và vỡ chữ.
        'flex shrink-0 items-center gap-2.5 rounded-ctl px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
        on ? 'bg-brand-soft text-brand-deep' : 'text-muted hover:bg-sunken hover:text-ink',
      )}
    >
      <span className={cx('shrink-0', on ? 'text-brand' : 'text-faint')}>{icon}</span>
      <span className="truncate">{children}</span>
    </Link>
  )
}

export function NavTab({
  href, icon, chinhXac, children,
}: { href: string; icon: ReactNode; chinhXac?: boolean; children: ReactNode }) {
  const path = usePathname()
  const on = dangO(path, href, chinhXac)
  return (
    <Link
      href={href}
      aria-current={on ? 'page' : undefined}
      className={cx(
        'flex flex-1 flex-col items-center gap-1 py-2 text-[0.6875rem] font-medium transition-colors',
        on ? 'text-brand' : 'text-faint hover:text-muted',
      )}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}
