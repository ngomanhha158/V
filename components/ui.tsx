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
  chinh: 'bg-brand text-on-brand hover:bg-brand-deep border-transparent shadow-card',
  phu: 'bg-surface text-ink border-line-firm hover:bg-sunken',
  nhat: 'bg-transparent text-muted border-transparent hover:bg-sunken hover:text-ink',
  nguy: 'bg-surface text-bad border-bad-line hover:bg-bad-soft',
}
const NUT_CO: Record<Co, string> = {
  sm: 'h-8 px-2.5 text-[0.8125rem] gap-1.5',
  md: 'h-10 px-3.5 text-sm gap-2',
}
/**
 * Nút phải NHÚN khi bấm.
 *
 * Trước đây chỉ có `transition-colors`: bấm xuống không có gì nhúc nhích cho
 * tới khi máy chủ trả lời. Trên mạng 3G ở hầm gửi xe, khoảng lặng đó dài tới
 * mức người ta bấm lại lần hai — và với nút "Xác nhận thu tiền" thì bấm hai
 * lần không phải chuyện thẩm mỹ nữa.
 *
 * 0.985 và 1px là cố ý nhỏ. Đủ để ngón tay tin là máy đã nhận, chưa đủ để
 * thành trò biểu diễn trên một màn hình người ta nhìn tám tiếng mỗi ngày.
 */
const NUT_NEN =
  'inline-flex items-center justify-center rounded-ctl border font-medium ' +
  'whitespace-nowrap select-none ' +
  // `transition` trần, KHÔNG phải transition-[...transform]. Tailwind v4 sinh ra
  // thuộc tính `translate`/`scale` riêng chứ không gộp vào `transform`, nên liệt
  // kê transform là trỏ vào một thuộc tính không bao giờ đổi: nút vẫn nhún,
  // nhưng nhún giật một nhịp thay vì chuyển mượt. Bản `transition` mặc định của
  // v4 đã bao gồm translate/scale/rotate.
  'transition duration-[var(--dur-nhanh)] ease-[var(--ease-ra)] ' +
  'active:translate-y-px active:scale-[0.985] ' +
  'disabled:pointer-events-none disabled:opacity-45'

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

// ─────────────────────────── Nhãn nhóm ───────────────────────────

/**
 * Nhãn in hoa đặt trên một nhóm khối.
 *
 * Chuỗi lớp này đang được chép tay ở bốn màn cư dân và thanh điều hướng — chép
 * tay thì sớm muộn có chỗ lệch một bậc chữ và không ai nhận ra, vì chúng nằm ở
 * bốn màn khác nhau, không bao giờ hiện cùng lúc để mà so.
 *
 * Quan trọng hơn: nó mở ra chỗ để GỌI TÊN các nhóm đang vô hình. Dashboard có
 * hai nhóm số với hai ý nghĩa khác hẳn nhau — số mang đi họp, và số đang cháy
 * lúc này — nhưng trên màn chúng vẽ y hệt nhau, chỉ có comment trong code là
 * biết. Người đọc thấy tám ô rời rạc.
 */
export function NhanNhom({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cx(
      'px-1 text-[0.75rem] font-semibold tracking-wider text-faint uppercase',
      className,
    )}>
      {children}
    </h2>
  )
}

// ─────────────────────────── Ô thống kê ───────────────────────────

/**
 * ĐẢO NGƯỢC THỨ BẬC so với bản trước, và đó là điểm chính.
 *
 * Trước đây nhãn và dòng phụ cùng cỡ 0.8125rem với con số 1.5rem — ba tầng gần
 * bằng nhau. Tám ô như vậy xếp thành lưới thì mắt không có chỗ bám: người đọc
 * phải quét từng ô một để tìm thứ mình cần, mỗi lần mở màn. Trên một dashboard
 * thì con số LÀ nội dung, nhãn chỉ để biết con số đó là gì.
 *
 * Nên nhãn lùi hẳn về sau (nhỏ hơn, in hoa, màu nhạt — cùng kiểu với nhãn nhóm
 * ở thanh bên và đầu cột bảng), còn con số nhô lên: to hơn, chữ bám sát nhau
 * hơn. Tracking âm là chuẩn typographic — chữ càng to thì khoảng cách tương
 * đối phải càng chặt, không thì các chữ số rời ra thành từng mảnh.
 *
 * Dòng phụ lên text-muted: nó đang là text-faint, tương phản thấp tới mức trên
 * màn hình ngoài sáng gần như đọc không ra — mà nó thường là chỗ giải thích con
 * số nghĩa là gì.
 */
export function Stat({
  nhan, so, phu, tone = 'trung', href,
}: { nhan: string; so: ReactNode; phu?: ReactNode; tone?: Tone; href?: string }) {
  const than = (
    <>
      <div className="text-[0.75rem] font-semibold tracking-wide text-faint uppercase">{nhan}</div>
      <div
        className={cx(
          // Bậc nhỏ hơn trên điện thoại: hai ô nằm cạnh nhau trong 430px, mà
          // tiền Việt viết đủ chữ số thì rất dài — "4.523.500đ" ở 30px là tràn.
          // KHÔNG có `num` ở đây. tabular-nums ép mọi chữ số về cùng bề rộng
          // để mắt dóng được cột — đúng cho hàng bảng và vạch trục, sai cho một
          // con số lớn đứng một mình: chữ số 1 bị đệm thành ô rộng bằng chữ số
          // 0, nên "121" trông rời ra từng mảnh ở cỡ hiển thị. Ở đây bốn ô nằm
          // NGANG và đo bốn thứ khác nhau — không có cột nào để mà dóng.
          'mt-2 text-[1.625rem] leading-[1.05] font-semibold tracking-[-0.02em] sm:text-[1.875rem]',
          tone === 'xau' ? 'text-bad' : tone === 'canh' ? 'text-warn'
            : tone === 'tot' ? 'text-ok' : 'text-ink',
        )}
      >
        {so}
      </div>
      {phu && <div className="mt-2 text-[0.8125rem] leading-snug text-muted">{phu}</div>}
    </>
  )
  // Ô bấm được nhấc lên khỏi mặt phẳng; ô không bấm được nằm yên. Đó là cách
  // duy nhất phân biệt hai loại ô mà không phải viết thêm chữ — trước đây cả
  // hai trông y hệt nhau và người dùng phải rê chuột khắp bảng để dò xem cái
  // nào bấm được.
  const lop = cx(
    'rounded-card border border-line bg-surface px-4 py-3.5 shadow-card',
    href && 'block transition duration-[var(--dur-vua)] ease-[var(--ease-ra)] '
      + 'hover:-translate-y-0.5 hover:border-line-firm hover:shadow-pop '
      + 'active:translate-y-0 active:shadow-card',
  )
  return href ? <Link href={href} className={lop}>{than}</Link>
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

// ─────────────────────────── Trạng thái đang tải ───────────────────────────

/**
 * Khung xám thay chỗ nội dung chưa về.
 *
 * Vì sao cần, và vì sao là thứ đáng làm nhất trong cả hệ: 116 route của app
 * đều là server component `force-dynamic`, và KHÔNG route nào có màn chờ. Bấm
 * sang "Công nợ" thì màn hình cũ đứng nguyên vài trăm mili-giây tới vài giây,
 * không dấu hiệu gì. Người dùng không kết luận "đang tải" — họ kết luận "máy
 * đơ" và bấm lại.
 *
 * Khung xám không làm dữ liệu về nhanh hơn một mili-giây nào. Nó chỉ trả lời
 * đúng một câu, ngay lập tức: máy có nghe thấy bạn. Đó là chênh lệch lớn nhất
 * giữa một app dùng được và một app dùng thấy đắt tiền.
 *
 * Giữ ĐÚNG hình dạng của thứ sắp thay thế nó. Khung sai kích thước thì lúc dữ
 * liệu về, cả trang nhảy một cái — tệ hơn là không có khung nào.
 */
export function Khung({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      // bg-line chứ không bg-sunken: sunken (#f2f4f7) nằm trên thẻ trắng chỉ
      // chênh 4%, nhìn ra một mảng trắng hơi bẩn chứ không ra khung chờ. Khung
      // mờ quá thì mất luôn tác dụng — người dùng vẫn thấy màn hình trống.
      className={cx('animate-pulse rounded-ctl bg-line', className)}
    />
  )
}

/** Khung cho một thẻ nội dung: một dòng tiêu đề, ba dòng thân. */
export function KhungThe({ dong = 3, className }: { dong?: number; className?: string }) {
  return (
    <div className={cx('rounded-card border border-line bg-surface p-4', className)}>
      <Khung className="h-4 w-1/3" />
      <div className="mt-3.5 space-y-2.5">
        {Array.from({ length: dong }, (_, i) => (
          // Dòng cuối ngắn hơn, như một đoạn văn thật. Ba dòng dài bằng nhau
          // trông giống thanh tiến trình hơn là giống chữ.
          <Khung key={i} className={cx('h-3', i === dong - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

/** Khung cho một hàng ô thống kê. */
export function KhungStat({ so = 4 }: { so?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: so }, (_, i) => (
        <div key={i} className="rounded-card border border-line bg-surface px-4 py-3.5">
          <Khung className="h-3 w-24" />
          <Khung className="mt-2.5 h-7 w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * Khung cho một bảng dữ liệu.
 *
 * Vẽ cả phần đầu bảng vì đó là thứ ổn định — tên cột không đổi theo dữ liệu.
 * Người đọc nhận ra ngay mình đang ở bảng nào trong lúc số còn đang về.
 */
export function KhungBang({ dong = 6, cot = 4 }: { dong?: number; cot?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex gap-4 border-b border-line bg-raised px-3 py-2.5">
        {Array.from({ length: cot }, (_, i) => <Khung key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: dong }, (_, i) => (
        <div key={i} className="flex gap-4 border-b border-line px-3 py-3.5 last:border-b-0">
          {Array.from({ length: cot }, (_, j) => <Khung key={j} className="h-3.5 flex-1" />)}
        </div>
      ))}
    </div>
  )
}

/**
 * Vòng xoay, cho thao tác NGẮN mà người dùng vừa tự bấm.
 *
 * Khác Khung ở chỗ dùng lúc nào: khung thay cho nội dung CHƯA TỪNG có trên
 * màn; vòng xoay đứng trong nút mà người ta vừa bấm, nơi bố cục đã ổn định và
 * chỉ còn chờ một câu trả lời.
 */
export function Xoay({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16" aria-hidden
      className={cx('size-4 shrink-0 animate-spin', className)}
    >
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      {/* Một phần tư cung: đủ để thấy rõ chiều quay. Cung dài hơn thì lúc quay
          nhanh trông như vòng tròn đặc và mất luôn cảm giác chuyển động. */}
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      />
    </svg>
  )
}
