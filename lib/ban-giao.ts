/**
 * Chốt sổ bàn giao — chữ nghĩa dùng chung giữa màn BQL và màn cư dân.
 *
 * Câu quan trọng nhất là câu nói BẢN CHỐT ĐÃ CÓ HIỆU LỰC CHƯA. Một bản mới lập
 * và một bản hai bên đã ký trông giống hệt nhau nếu chỉ hiện các con số — mà
 * chúng khác nhau hoàn toàn: một cái là bản nháp, cái kia là thỏa thuận.
 */

export type TrangThaiChot = 'da_huy' | 'da_ky' | 'cho_bql' | 'cho_bqt' | 'cho_ca_hai'

export function trangThaiChot(c: {
  huy_luc: string | null
  ky_bql_luc: string | null
  ky_bqt_luc: string | null
}): TrangThaiChot {
  if (c.huy_luc) return 'da_huy'
  if (c.ky_bql_luc && c.ky_bqt_luc) return 'da_ky'
  if (c.ky_bql_luc) return 'cho_bqt'
  if (c.ky_bqt_luc) return 'cho_bql'
  return 'cho_ca_hai'
}

export const NHAN_TRANG_THAI: Record<TrangThaiChot, string> = {
  da_ky: 'Hai bên đã ký',
  cho_bqt: 'Chờ BQT ký',
  cho_bql: 'Chờ BQL ký',
  cho_ca_hai: 'Chưa bên nào ký',
  da_huy: 'Đã hủy',
}

export const TONE_TRANG_THAI: Record<TrangThaiChot, 'tot' | 'canh' | 'xau' | 'trung'> = {
  da_ky: 'tot',
  cho_bqt: 'canh',
  cho_bql: 'canh',
  cho_ca_hai: 'canh',
  da_huy: 'trung',
}

/**
 * Bản chốt này dùng được chưa, và nếu chưa thì còn thiếu ai.
 *
 * Nói "chưa ký" trống không thì người đọc không biết phải đi gọi ai — mà cả
 * việc chốt sổ đứng lại chỉ vì một chữ ký là chuyện thường gặp nhất.
 */
export function loiHieuLuc(t: TrangThaiChot, lyDoHuy?: string | null) {
  switch (t) {
    case 'da_ky':
      return {
        ok: true as const,
        tieu: 'Bản chốt đã có hiệu lực',
        than:
          'Hai bên đã ký. Số liệu trên đây là con số hai bên thống nhất tại ngày chốt, '
          + 'và không đổi nữa dù về sau có ai trả thêm hay nợ thêm.',
      }
    case 'da_huy':
      return {
        ok: false as const,
        tieu: 'Bản chốt này đã hủy',
        than: `Lý do: ${lyDoHuy?.trim() || 'không ghi'}. Đừng dùng số liệu ở đây để đối chiếu.`,
      }
    case 'cho_bqt':
      return {
        ok: false as const,
        tieu: 'Còn chờ ban quản trị ký',
        than: 'Ban quản lý đã ký. Bản chốt chỉ có hiệu lực khi có đủ chữ ký của cả hai bên.',
      }
    case 'cho_bql':
      return {
        ok: false as const,
        tieu: 'Còn chờ ban quản lý ký',
        than: 'Ban quản trị đã ký. Bản chốt chỉ có hiệu lực khi có đủ chữ ký của cả hai bên.',
      }
    default:
      return {
        ok: false as const,
        tieu: 'Chưa bên nào ký',
        than:
          'Đây mới là số liệu đã đóng băng, chưa phải thỏa thuận. Hai bên đọc lại rồi ký; '
          + 'thấy sai thì hủy và lập bản mới, không sửa bản này.',
      }
  }
}

/**
 * Tỷ lệ căn có công nợ, viết bằng lời.
 *
 * "37/468" thì người đọc phải tự chia. Con số quyết định khi bàn giao là bao
 * nhiêu PHẦN TRĂM căn đang nợ — 8% là bình thường, 40% là một vấn đề phải nói
 * ra trước khi ký.
 */
export function loiTyLeNo(soCanNo: number, soCan: number) {
  if (soCan === 0) return { muc: 'trung' as const, loi: 'Chưa có căn hộ nào trong hệ thống.' }
  const pt = Math.round((1000 * soCanNo) / soCan) / 10
  const muc = pt >= 25 ? ('xau' as const) : pt >= 10 ? ('canh' as const) : ('tot' as const)
  return {
    muc,
    loi:
      `${soCanNo} trên ${soCan} căn đang có công nợ (${String(pt).replace('.', ',')}%).`
      + (muc === 'xau'
        ? ' Mức này cao — nói rõ nguyên nhân trong biên bản trước khi hai bên ký.'
        : ''),
  }
}

/** Chênh lệch giữa sổ quỹ và số ngân hàng báo tại thời điểm chốt. */
export function loiLechQuy(soSach: number, nganHang: number | null) {
  if (nganHang == null) {
    return {
      ok: false as const,
      loi:
        'Chưa có số dư ngân hàng nào để đối chiếu tại thời điểm chốt. '
        + 'Bàn giao quỹ mà không có sao kê thì con số này chỉ là sổ tự nói sổ đúng.',
    }
  }
  const lech = soSach - nganHang
  if (lech === 0) return { ok: true as const, loi: 'Sổ quỹ khớp số ngân hàng báo.' }
  return {
    ok: false as const,
    loi:
      `Sổ quỹ ${lech > 0 ? 'nhiều hơn' : 'ít hơn'} ngân hàng `
      + `${Math.abs(lech).toLocaleString('vi-VN')}đ. Tìm ra chênh lệch trước khi ký — `
      + 'ký rồi thì con số này thành con số hai bên đã thống nhất.',
  }
}
