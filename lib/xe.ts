/**
 * Nhãn và cách diễn đạt cho chỗ đỗ xe. Màn thật và màn demo dùng chung — lệch
 * chữ là bản demo dạy sai người đọc đúng con số họ sẽ nhìn.
 */
export const LOAI_XE = ['o_to', 'xe_may', 'xe_dap', 'khac'] as const
export type LoaiXe = (typeof LOAI_XE)[number]

export const NHAN_LOAI: Record<LoaiXe, string> = {
  o_to: 'Ô tô', xe_may: 'Xe máy', xe_dap: 'Xe đạp', khac: 'Khác',
}
export const nhanLoai = (v: string | null | undefined) =>
  (v && NHAN_LOAI[v as LoaiXe]) || v || '—'

/**
 * Hai kiểu chờ, hai câu khác hẳn nhau — và đó là cả điểm của việc tách chúng ra.
 * Người đang đợi hầm trống thì có số thứ tự và cứ đợi; người vượt hạn mức căn
 * thì đợi mãi cũng không tới lượt, họ phải đi nói chuyện với ban quản lý. Nói
 * chung một câu cho cả hai là để một nửa số người chờ vô ích.
 */
export const NHAN_TRANG_THAI: Record<string, string> = {
  da_duyet: 'Đang dùng chỗ',
  hang_cho: 'Đang xếp hàng',
  qua_han_muc: 'Vượt hạn mức căn',
}

export function loiChoDoi(trangThai: string, viTri: number): string {
  if (trangThai === 'da_duyet') return 'Đã có chỗ trong hầm.'
  if (trangThai === 'qua_han_muc') {
    return 'Căn của bạn đã dùng hết số chỗ được cấp, nên chiếc này chưa vào hàng '
      + 'chờ. Xếp hàng cũng không tới lượt — cần ban quản lý nới hạn mức cho căn.'
  }
  return viTri > 0
    ? `Đang xếp hàng, bạn ở vị trí ${viTri}. Có chỗ trống thì ban quản lý gọi theo thứ tự đăng ký.`
    : 'Đang xếp hàng chờ chỗ trống.'
}

/** "2 / 3" — và nói rõ khi tòa chưa đặt hạn mức, thay vì hiện "2 / 0". */
export function docHanMuc(daDung: number, moiCan: number, coHanMuc: boolean): string {
  return coHanMuc ? `${daDung} / ${moiCan}` : `${daDung} (chưa đặt hạn mức)`
}

/** Còn bao nhiêu chỗ trong hầm. Âm là đã trót nhận quá — hiện 0 chứ không hiện
 *  số âm, nhưng chỗ gọi phải biết để cảnh báo. */
export function conTrong(tongCho: number, dangDung: number): number {
  return Math.max(0, tongCho - dangDung)
}

/**
 * "hầm còn 3 chỗ" / "hầm đã đầy".
 *
 * KHÔNG viết "còn 0/2": người đọc không biết 0 là số còn hay số đã dùng, và
 * đoán sai theo hướng nào cũng dẫn tới một cuộc gọi cho ban quản lý.
 */
export function docConTrong(tongCho: number, dangDung: number): string {
  const con = conTrong(tongCho, dangDung)
  return con === 0 ? `hầm đã đầy (${tongCho} chỗ)` : `hầm còn ${con} chỗ trong ${tongCho}`
}

export const vuotSucChua = (tongCho: number, dangDung: number) => dangDung > tongCho
