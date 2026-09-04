import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
// Định dạng ngày/số nằm ở lib/ngay.ts: nó thuần tuý nên test bằng node:test
// được, mà vẫn xuất lại từ đây để mọi màn đang import khỏi phải sửa.
export { ngayGioVN, ngayVN, soVN } from '@/lib/ngay'

// Nhận cả number vì `cond && 'lop'` với cond là số sẽ ra số, không phải false.
export const cx = (...v: (string | number | false | null | undefined)[]) =>
  v.filter((x): x is string => typeof x === 'string' && x.length > 0).join(' ')

/** Tiền VND. Luôn dùng hàm này — đừng nơi thì 2.983.500đ, nơi thì 2983500 VND. */
export const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

/** Số tiền rút gọn cho ô thống kê: 33.1 tr, 1.2 tỷ. Bảng thì vẫn dùng số đầy đủ. */
export function vndGon(n: number) {
  const a = Math.abs(n)
  if (a >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace('.', ',') + ' tỷ'
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' tr'
  if (a >= 1_000) return Math.round(n / 1_000) + ' N'
  return String(n)
}

// ─────────────────────────── Bề mặt ───────────────────────────

export function Card({
  className, children, ...rest
}: ComponentProps<'section'>) {
  return (
    <section
      {...rest}
      className={cx(
        'rounded-card border border-line bg-surface shadow-card',
        className,
      )}
    >
      {children}
    </section>
  )
}

/**
 * `xuongDong` cho những thẻ mà tiêu đề là một CÂU chứ không phải một nhãn — nội
 * dung nghị quyết đưa ra biểu quyết chẳng hạn. Mặc định vẫn cắt một dòng: phần
 * lớn thẻ có tiêu đề ngắn, và ở đó cắt giữ cho chiều cao các thẻ bằng nhau.
 * Cắt một câu dài thì người đọc mất đúng phần đang bỏ phiếu cho.
 */
export function CardHead({
  title, sub, right, className, xuongDong,
}: {
  title: ReactNode; sub?: ReactNode; right?: ReactNode
  className?: string; xuongDong?: boolean
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className={cx(
          'text-[0.9375rem] font-semibold text-ink',
          xuongDong ? 'break-words' : 'truncate',
        )}>{title}</h2>
        {sub && <p className="mt-0.5 text-[0.8125rem] text-muted">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

export function PageHead({
  title, sub, actions, breadcrumb,
}: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <header className="mb-5">
      {breadcrumb && <div className="mb-2 text-[0.8125rem] text-faint">{breadcrumb}</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.375rem] font-semibold text-ink sm:text-[1.5rem]">{title}</h1>
          {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}

// ─────────────────────────── Nút ───────────────────────────

type Dang = 'chinh' | 'phu' | 'nhat' | 'nguy'
type Co = 'sm' | 'md'

const NUT_DANG: Record<Dang, string> = {
  chinh: 'bg-brand text-on-brand hover:bg-brand-deep border-transparent',
  phu: 'bg-surface text-ink border-line-firm hover:bg-sunken',
  nhat: 'bg-transparent text-muted border-transparent hover:bg-sunken hover:text-ink',
  nguy: 'bg-surface text-bad border-bad-line hover:bg-bad-soft',
}
const NUT_CO: Record<Co, string> = {
  sm: 'h-8 px-2.5 text-[0.8125rem] gap-1.5',
  md: 'h-10 px-3.5 text-sm gap-2',
}
const NUT_NEN =
  'inline-flex items-center justify-center rounded-ctl border font-medium ' +
  'transition-colors disabled:pointer-events-none disabled:opacity-45 whitespace-nowrap'

export function Button({
  dang = 'phu', co = 'md', className, ...rest
}: ComponentProps<'button'> & { dang?: Dang; co?: Co }) {
  return <button {...rest} className={cx(NUT_NEN, NUT_DANG[dang], NUT_CO[co], className)} />
}

export function LinkButton({
  dang = 'phu', co = 'md', className, ...rest
}: ComponentProps<typeof Link> & { dang?: Dang; co?: Co }) {
  return <Link {...rest} className={cx(NUT_NEN, NUT_DANG[dang], NUT_CO[co], className)} />
}

// ─────────────────────────── Nhãn trạng thái ───────────────────────────

export type Tone = 'trung' | 'tot' | 'canh' | 'xau' | 'brand'

const TONE_PILL: Record<Tone, string> = {
  trung: 'bg-sunken text-muted border-line',
  tot: 'bg-ok-soft text-ok border-ok-line',
  canh: 'bg-warn-soft text-warn border-warn-line',
  xau: 'bg-bad-soft text-bad border-bad-line',
  brand: 'bg-brand-soft text-brand-deep border-brand-line',
}
const TONE_CHAM: Record<Tone, string> = {
  trung: 'bg-faint', tot: 'bg-ok', canh: 'bg-warn', xau: 'bg-bad', brand: 'bg-brand',
}

/**
 * Chấm màu + CHỮ, không bao giờ chỉ mỗi màu. Khoảng 8% đàn ông Việt Nam mù màu
 * đỏ-lục ở mức nào đó; phân biệt "quá hạn" với "đã thu" chỉ bằng đỏ/xanh là
 * loại họ ra khỏi bảng công nợ.
 */
export function Pill({
  tone = 'trung', cham = true, children, className,
}: { tone?: Tone; cham?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-[0.75rem] font-medium whitespace-nowrap',
        TONE_PILL[tone], className,
      )}
    >
      {cham && <span className={cx('size-1.5 shrink-0 rounded-full', TONE_CHAM[tone])} />}
      {children}
    </span>
  )
}

// ─────────────────────────── Ô thống kê ───────────────────────────

export function Stat({
  nhan, so, phu, tone = 'trung', href,
}: { nhan: string; so: ReactNode; phu?: ReactNode; tone?: Tone; href?: string }) {
  const than = (
    <>
      <div className="text-[0.8125rem] font-medium text-muted">{nhan}</div>
      <div
        className={cx(
          'num mt-1.5 text-[1.5rem] leading-none font-semibold',
          tone === 'xau' ? 'text-bad' : tone === 'canh' ? 'text-warn'
            : tone === 'tot' ? 'text-ok' : 'text-ink',
        )}
      >
        {so}
      </div>
      {phu && <div className="mt-1.5 text-[0.8125rem] text-faint">{phu}</div>}
    </>
  )
  const lop = cx(
    'rounded-card border border-line bg-surface px-4 py-3.5 shadow-card',
    href && 'transition-colors hover:border-line-firm hover:bg-raised',
  )
  return href ? <Link href={href} className={cx(lop, 'block')}>{than}</Link>
    : <div className={lop}>{than}</div>
}

// ─────────────────────────── Thông báo ───────────────────────────

const HOP_TONE: Record<Tone, string> = {
  trung: 'bg-sunken border-line text-muted',
  tot: 'bg-ok-soft border-ok-line text-ok',
  canh: 'bg-warn-soft border-warn-line text-warn',
  xau: 'bg-bad-soft border-bad-line text-bad',
  brand: 'bg-brand-soft border-brand-line text-brand-deep',
}

export function Hop({
  tone = 'trung', title, children, className,
}: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-card border px-3.5 py-3 text-[0.8125rem]', HOP_TONE[tone], className)}>
      {title && <div className="font-semibold">{title}</div>}
      {children && <div className={cx(title ? 'mt-1' : '', 'leading-relaxed')}>{children}</div>}
    </div>
  )
}

export function Trong({
  title, children, action,
}: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-firm px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-[0.8125rem] text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

// ─────────────────────────── Bảng ───────────────────────────

export function Bang({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="scroll-x overflow-x-auto">
      <table className={cx('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  )
}

export function Th({
  className, phai, ...rest
}: ComponentProps<'th'> & { phai?: boolean }) {
  return (
    <th
      {...rest}
      className={cx(
        'border-b border-line bg-raised px-3 py-2.5 text-[0.75rem] font-semibold',
        'tracking-wide text-muted uppercase whitespace-nowrap',
        phai ? 'text-right' : 'text-left',
        className,
      )}
    />
  )
}

export function Td({
  className, phai, so, ...rest
}: ComponentProps<'td'> & { phai?: boolean; so?: boolean }) {
  return (
    <td
      {...rest}
      className={cx(
        'border-b border-line px-3 py-3 align-top',
        phai && 'text-right', so && 'num',
        className,
      )}
    />
  )
}

export function Tr({ className, ...rest }: ComponentProps<'tr'>) {
  return <tr {...rest} className={cx('transition-colors hover:bg-raised', className)} />
}

// ─────────────────────────── Biểu mẫu ───────────────────────────

export function Field({
  label, hint, error, children, className,
}: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">{label}</span>
      {children}
      {error
        ? <span className="mt-1.5 block text-[0.75rem] text-bad">{error}</span>
        : hint && <span className="mt-1.5 block text-[0.75rem] text-faint">{hint}</span>}
    </label>
  )
}

const O_NEN =
  'w-full rounded-ctl border border-line-firm bg-surface px-3 text-sm text-ink ' +
  'placeholder:text-faint transition-colors focus:border-brand disabled:bg-sunken ' +
  'disabled:text-faint'

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input {...rest} className={cx(O_NEN, 'h-10', className)} />
}

export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return <select {...rest} className={cx(O_NEN, 'h-10', className)} />
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea {...rest} className={cx(O_NEN, 'py-2.5', className)} />
}

// ─────────────────────────── Điều hướng phụ ───────────────────────────

export function Chip({
  href, active, children,
}: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        'rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
        active
          ? 'border-transparent bg-ink text-canvas'
          : 'border-line bg-surface text-muted hover:border-line-firm hover:text-ink',
      )}
    >
      {children}
    </Link>
  )
}

/** Hai dòng nhãn/giá trị, dùng trong thẻ chi tiết. */
export function Doi({
  nhan, children, className,
}: { nhan: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-2', className)}>
      <dt className="shrink-0 text-[0.8125rem] text-muted">{nhan}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}
