/**
 * Định dạng ngày và số theo lối Việt.
 *
 * Tách khỏi components/ui.tsx để test bằng node:test mà không kéo React vào,
 * và để cả app chỉ có MỘT cách định dạng ngày — hai cách là sớm muộn có màn
 * hiện 30/08 còn màn kia hiện 08/30.
 */

/**
 * 2026-08-30T02:30:00Z -> '30/08/2026 09:30' (giờ VN).
 * toLocaleString('vi-VN') trả về giờ TRƯỚC ngày ("09:30:00 30/8/2026") — đọc
 * ngược với mọi chỗ khác trong app, mà mốc thời gian trên màn đối soát là thứ
 * người ta dò tay với sao kê ngân hàng nên phải cùng một dạng.
 */
export function ngayGioVN(iso: string): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`
}

/**
 * Số thập phân kiểu Việt: 82.1 -> '82,1'. Dấu phẩy là dấu thập phân ở VN;
 * để '82.1' trên màn hình tiếng Việt là đọc thành tám mươi hai nghìn một.
 */
export const soVN = (n: number, le = 1) => n.toFixed(le).replace('.', ',')

/** 2026-08-29 -> 29/08/2026. Người Việt đọc ngày trước, không phải năm trước. */
export const ngayVN = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
