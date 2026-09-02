/**
 * Bảo trì định kỳ: nhãn hạng mục và cách đọc một cái hạn.
 *
 * Thuần tuý, không đụng database — màn thật và màn demo cùng dùng, và test được.
 */

export const HANG_MUC: Record<string, { nhan: string; luat: boolean }> = {
  thang_may: { nhan: 'Thang máy', luat: true },
  pccc: { nhan: 'Phòng cháy chữa cháy', luat: true },
  bom_nuoc: { nhan: 'Bơm và bể nước', luat: false },
  dien: { nhan: 'Điện và máy phát', luat: true },
  thang_bo: { nhan: 'Thang bộ, thoát hiểm', luat: false },
  ve_sinh: { nhan: 'Vệ sinh, diệt côn trùng', luat: false },
  khac: { nhan: 'Khác', luat: false },
}

export const tenHangMuc = (v: string) => HANG_MUC[v]?.nhan ?? v

/**
 * Chu kỳ hay gặp, tính theo ngày. Cho chọn số ngày tự do vẫn được, nhưng đây
 * là những mốc người ta thật sự nói ra: "quý một lần", "năm một lần".
 */
export const CHU_KY: { ngay: number; nhan: string }[] = [
  { ngay: 30, nhan: 'Hằng tháng' },
  { ngay: 90, nhan: 'Hằng quý' },
  { ngay: 180, nhan: 'Nửa năm' },
  { ngay: 365, nhan: 'Hằng năm' },
  { ngay: 730, nhan: 'Hai năm' },
]

export const tenChuKy = (n: number) =>
  CHU_KY.find((c) => c.ngay === n)?.nhan ?? `${n} ngày một lần`

export type MucDo = 'qua_han' | 'sap_toi' | 'con_xa'

export type TinhTrang = {
  muc: MucDo
  soNgay: number      // âm = đã quá hạn bấy nhiêu ngày
  nhan: string
  tone: 'xau' | 'canh' | 'tot'
}

/** Số ngày giữa hai mốc, tính theo NGÀY LỊCH chứ không theo 24 giờ tròn. */
export function soNgayToi(han: string, homNay: Date = new Date()): number {
  const [y, m, d] = han.slice(0, 10).split('-').map(Number)
  const a = Date.UTC(y, m - 1, d)
  const b = Date.UTC(homNay.getUTCFullYear(), homNay.getUTCMonth(), homNay.getUTCDate())
  return Math.round((a - b) / 86400_000)
}

/**
 * Đọc một cái hạn thành tình trạng để tô màu.
 *
 * Hạng mục bắt buộc theo luật thì **không có mức "còn xa"**: quá hạn kiểm định
 * thang máy là bị phạt và mất an toàn, nên ngay cả khi còn xa nó vẫn phải nổi
 * hơn một việc vệ sinh cùng ngày. Gộp chung một thang màu là để hai loại rủi
 * ro rất khác nhau trông giống nhau.
 */
export function tinhTrangHan(
  han: string, nhacTruocNgay: number, batBuoc: boolean, homNay: Date = new Date(),
): TinhTrang {
  const n = soNgayToi(han, homNay)
  if (n < 0) {
    return {
      muc: 'qua_han', soNgay: n, tone: 'xau',
      nhan: `quá ${-n} ngày`,
    }
  }
  if (n === 0) return { muc: 'sap_toi', soNgay: 0, tone: 'xau', nhan: 'đến hạn hôm nay' }
  if (n <= nhacTruocNgay) {
    return { muc: 'sap_toi', soNgay: n, tone: 'canh', nhan: `còn ${n} ngày` }
  }
  return {
    muc: 'con_xa', soNgay: n,
    tone: batBuoc ? 'canh' : 'tot',
    nhan: `còn ${n} ngày`,
  }
}

/** Sắp xếp: gấp nhất lên đầu. Quá hạn càng lâu càng lên trên. */
export const theoHan = (a: { han_ke_tiep: string }, b: { han_ke_tiep: string }) =>
  a.han_ke_tiep < b.han_ke_tiep ? -1 : a.han_ke_tiep > b.han_ke_tiep ? 1 : 0

/** Hạn kế tiếp sau khi làm xong hôm nay — dùng để xem trước trên màn. */
export function hanKeTiep(chuKyNgay: number, homNay: Date = new Date()): string {
  const d = new Date(Date.UTC(
    homNay.getUTCFullYear(), homNay.getUTCMonth(), homNay.getUTCDate() + chuKyNgay,
  ))
  return d.toISOString().slice(0, 10)
}
