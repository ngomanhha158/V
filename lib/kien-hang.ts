/**
 * Nhận hàng hộ — chữ nghĩa dùng chung giữa màn quầy lễ tân và màn cư dân.
 *
 * Nhãn loại kiện có ở CẢ SQL (hàm nhan_loai_kien, dùng khi sinh thông báo) lẫn
 * đây (dùng khi vẽ màn hình). Hai nơi vì thông báo sinh lúc bảo vệ bấm nhận,
 * còn màn hình vẽ lúc người ta mở app — nhưng chữ phải y hệt nhau, nếu không
 * cư dân đọc thông báo thấy "thùng lớn" rồi ra quầy hỏi một thứ không có trong
 * sổ. Test bên dưới chốt hai danh sách khớp nhau.
 */

export const LOAI_KIEN = ['phong_bi', 'kien_nho', 'thung_lon', 'hang_lanh'] as const
export type LoaiKien = (typeof LOAI_KIEN)[number]

export const NHAN_LOAI: Record<string, string> = {
  phong_bi: 'phong bì',
  kien_nho: 'kiện nhỏ',
  thung_lon: 'thùng lớn',
  hang_lanh: 'hàng lạnh',
}

export const nhanLoai = (l: string) => NHAN_LOAI[l] ?? l

/** Hoa đầu câu, cho những chỗ nhãn đứng một mình. */
export const nhanLoaiHoa = (l: string) => {
  const t = nhanLoai(l)
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const NHAN_TRANG_THAI: Record<string, string> = {
  dang_giu: 'Quầy đang giữ',
  da_lay: 'Đã lấy',
  da_huy: 'Đã hủy',
}

export const TONE_TRANG_THAI: Record<string, 'tot' | 'canh' | 'xau' | 'trung'> = {
  dang_giu: 'canh',
  da_lay: 'tot',
  da_huy: 'trung',
}

/** Khớp kien_han_ngay() trong SQL. */
export const HAN_NGAY = 3

/**
 * Kiện để bao lâu rồi, và có phải vấn đề chưa.
 *
 * Không viết "3 ngày" trần: người đọc phải tự so với hạn để biết thế là nhiều
 * hay ít. Hàng lạnh thì một ngày đã là nhiều — nói ra thay vì để quầy tự nhớ.
 */
export function loiTuoiKien(soNgay: number, loai: string) {
  if (loai === 'hang_lanh' && soNgay >= 1) {
    return {
      gap: true as const,
      loi: `Hàng lạnh, đã ${soNgay} ngày — gọi cư dân ngay, quầy không có tủ mát.`,
    }
  }
  if (soNgay >= HAN_NGAY) {
    return {
      gap: true as const,
      loi: `Quá ${soNgay} ngày, vượt hạn ${HAN_NGAY} ngày. Hệ thống đã nhắc cư dân mỗi ngày.`,
    }
  }
  if (soNgay === 0) return { gap: false as const, loi: 'Nhận hôm nay.' }
  return { gap: false as const, loi: `${soNgay} ngày, còn trong hạn ${HAN_NGAY} ngày.` }
}

/**
 * Câu cư dân đọc khi mở màn hàng của mình. Kiện đã lấy phải nói RÕ AI LẤY —
 * đó là cả lý do tính năng này tồn tại, và cũng là chỗ cư dân phát hiện ra
 * người nhà đã lấy hộ mà quên nói.
 */
export function loiKienCuaToi(k: {
  trang_thai: string
  ten_nguoi_lay: string | null
  ly_do_huy: string | null
  vi_tri: string | null
}): string {
  if (k.trang_thai === 'da_huy') {
    return `Đã hủy — ${k.ly_do_huy?.trim() || 'không ghi lý do'}.`
  }
  if (k.trang_thai === 'da_lay') {
    return k.ten_nguoi_lay?.trim()
      ? `${k.ten_nguoi_lay.trim()} đã lấy.`
      : 'Đã lấy, nhưng không ghi được tên người lấy — báo ban quản lý.'
  }
  return k.vi_tri?.trim()
    ? `Quầy đang giữ · ${k.vi_tri.trim()}`
    : 'Quầy đang giữ.'
}
