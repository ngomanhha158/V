/**
 * Khoảng thời gian cho báo cáo. Tính theo GIỜ VIỆT NAM, không phải giờ server.
 *
 * Server chạy UTC. `new Date()` lúc 6h sáng ngày 1 ở VN vẫn đang là ngày cuối
 * tháng trước theo UTC — lấy thẳng nó ra làm mốc "tháng này" thì báo cáo lệch
 * một tháng trong đúng 7 tiếng mỗi đầu tháng, và đó là 7 tiếng người ta hay mở
 * báo cáo nhất.
 */
export const KY = {
  'thang-nay':   'Tháng này',
  'thang-truoc': 'Tháng trước',
  '90-ngay':     '90 ngày gần đây',
  'nam-nay':     'Từ đầu năm',
} as const

export type KyKey = keyof typeof KY

export const laKy = (v?: string): v is KyKey => !!v && v in KY

/** 'YYYY-MM-DD' của hôm nay theo giờ VN. en-CA vì nó cho đúng dạng ISO. */
export function homNayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Ngày cuối của tháng m (1-12). Ngày 0 của tháng sau = ngày cuối tháng này. */
const cuoiThang = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

export function khoangNgay(ky: KyKey): { tu: string; den: string } {
  const [y, m, d] = homNayVN().split('-').map(Number)
  const den = iso(y, m, d)
  switch (ky) {
    case 'thang-nay':
      return { tu: iso(y, m, 1), den }
    case 'thang-truoc': {
      const ty = m === 1 ? y - 1 : y
      const tm = m === 1 ? 12 : m - 1
      return { tu: iso(ty, tm, 1), den: iso(ty, tm, cuoiThang(ty, tm)) }
    }
    case '90-ngay': {
      // Cộng trừ ngày bằng UTC: đổi sang giờ địa phương của server ở đây là mời
      // lỗi lệch ngày quay lại bằng cửa sau.
      const t = new Date(Date.UTC(y, m - 1, d - 89))
      return { tu: t.toISOString().slice(0, 10), den }
    }
    case 'nam-nay':
      return { tu: iso(y, 1, 1), den }
  }
}
