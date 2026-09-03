import Link from 'next/link'
import { cx, vnd } from '@/components/ui'
import { NHAN_NGAY, TONE_NGAY, nhanSuat, tinhNgay, type OSuat } from '@/lib/tien-ich'

export type ONgay = { ngay: string; o: OSuat[] }

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const NEN: Record<string, string> = {
  tot: 'bg-ok-soft border-ok-line text-ok',
  canh: 'bg-warn-soft border-warn-line text-warn',
  xau: 'bg-bad-soft border-bad-line text-bad',
  trung: 'bg-sunken border-line text-faint',
}

/**
 * Lịch tháng: mỗi ô là một NGÀY, màu theo còn chỗ hay không. Bấm vào ngày mới
 * mở ra danh sách suất.
 *
 * Vẽ hết suất của mọi ngày ra một lưới thì trên điện thoại nó thành một bức
 * tường ô vuông không đọc được. Ở mức ngày thì bảy cột vừa màn hình, và người
 * ta chọn ngày trước rồi mới chọn giờ — đúng thứ tự họ nghĩ.
 */
export function LichSuat({
  ngayDs, base, dangChon, phi,
}: {
  ngayDs: ONgay[]
  /** Đường dẫn nhận ?ngay=… ; bản demo truyền '#'. */
  base: string
  dangChon?: string
  phi?: number
}) {
  if (ngayDs.length === 0) return null
  // Đệm cho ngày đầu tiên rơi đúng cột thứ trong tuần. Thiếu bước này thì cả
  // lịch lệch đi và người ta đọc nhầm thứ — lỗi âm thầm nhất của một cái lịch.
  const dau = new Date(ngayDs[0].ngay + 'T00:00:00Z').getUTCDay()
  const dem = (dau + 6) % 7

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {THU.map((t) => (
          <div key={t} className="pb-1 text-[0.6875rem] font-semibold text-faint">{t}</div>
        ))}
        {Array.from({ length: dem }, (_, i) => <div key={`d${i}`} />)}
        {ngayDs.map((d) => {
          const t = tinhNgay(d.o)
          const chon = d.ngay === dangChon
          const noiDung = (
            <>
              <span className="num text-[0.8125rem] leading-none font-semibold">
                {d.ngay.slice(8, 10)}
              </span>
              <span className="mt-0.5 block text-[0.5625rem] leading-none">{NHAN_NGAY[t]}</span>
            </>
          )
          const lop = cx(
            'flex flex-col items-center justify-center rounded-lg border py-1.5',
            NEN[TONE_NGAY[t]],
            chon && 'ring-2 ring-brand ring-offset-1 ring-offset-surface',
          )
          return base === '#' ? (
            <div key={d.ngay} className={lop}>{noiDung}</div>
          ) : (
            <Link key={d.ngay} href={`${base}?ngay=${d.ngay}`} className={cx(lop, 'hover:opacity-80')}>
              {noiDung}
            </Link>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-muted">
        {(['trong', 'con_it', 'kin', 'dong'] as const).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={cx('size-2.5 rounded-full border', NEN[TONE_NGAY[t]])} />
            {NHAN_NGAY[t]}
          </span>
        ))}
        {phi !== undefined && phi > 0 && (
          <span className="num ml-auto font-medium text-ink">{vnd(phi)} / suất</span>
        )}
      </div>
    </div>
  )
}

export function NhanSuat({ o }: { o: OSuat }) {
  return <span className="num">{nhanSuat(o.bat_dau, o.ket_thuc)}</span>
}
