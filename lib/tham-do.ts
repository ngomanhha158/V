/**
 * Thăm dò trên bảng tin: quy phiếu ra phần trăm.
 *
 * Thuần tuý, không đụng database — màn thật và màn demo cùng dùng, test được.
 */

export type KetQua = { chon: number; so_phieu: number }

/**
 * Quy số phiếu ra phần trăm nguyên, **tổng luôn đúng 100**.
 *
 * Làm tròn từng phần riêng lẻ thì 1/3 + 1/3 + 1/3 ra 33 + 33 + 33 = 99, và
 * người đọc thấy một bảng kết quả thiếu 1% — trông như hệ thống đếm sót phiếu,
 * mà mất niềm tin vào con số là mất cả cuộc thăm dò.
 *
 * Dùng phép chia phần dư lớn nhất: chia phần nguyên trước, rồi phát nốt phần
 * còn thiếu cho những lựa chọn có phần dư lớn nhất.
 */
export function phanTram(phieu: number[]): number[] {
  const tong = phieu.reduce((s, n) => s + n, 0)
  if (tong <= 0) return phieu.map(() => 0)

  const tho = phieu.map((n) => (n * 100) / tong)
  const nguyen = tho.map(Math.floor)
  let con = 100 - nguyen.reduce((s, n) => s + n, 0)

  // Phần dư bằng nhau thì ưu tiên lựa chọn đứng trước — để cùng một bộ phiếu
  // luôn ra cùng một bảng, không nhảy mỗi lần tải lại.
  const thuTu = tho
    .map((v, i) => ({ i, du: v - Math.floor(v) }))
    .sort((a, b) => (b.du - a.du) || (a.i - b.i))

  for (const { i } of thuTu) {
    if (con <= 0) break
    nguyen[i] += 1
    con -= 1
  }
  return nguyen
}

/** Đếm phiếu về mảng theo đúng thứ tự lựa chọn, kể cả lựa chọn chưa ai chọn. */
export function demTheoLuaChon(ketQua: KetQua[], soLuaChon: number): number[] {
  const ra = new Array(soLuaChon).fill(0)
  for (const k of ketQua) {
    // Lựa chọn ngoài khoảng: có thể là BQL vừa xóa bớt một lựa chọn sau khi đã
    // có phiếu. Bỏ qua chứ không nổ, nhưng cũng không gộp vào lựa chọn khác —
    // gộp là bịa ra một con số không ai bỏ.
    if (k.chon >= 0 && k.chon < soLuaChon) ra[k.chon] = k.so_phieu
  }
  return ra
}

export const tongPhieu = (phieu: number[]) => phieu.reduce((s, n) => s + n, 0)

export type TrangThaiThamDo = 'dang_mo' | 'da_dong' | 'kin_chua_dong'

export function trangThai(
  kin: boolean, dongLuc: string | null, bayGio: Date = new Date(),
): TrangThaiThamDo {
  const dong = dongLuc !== null && new Date(dongLuc) <= bayGio
  if (dong) return 'da_dong'
  return kin ? 'kin_chua_dong' : 'dang_mo'
}

export const NHAN_TRANG_THAI: Record<TrangThaiThamDo, string> = {
  dang_mo: 'Đang mở',
  da_dong: 'Đã đóng',
  kin_chua_dong: 'Kết quả công bố khi đóng',
}
