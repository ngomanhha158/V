/**
 * Khách thăm — phần chữ nghĩa dùng chung giữa màn cư dân, màn bảo vệ và sổ ra vào.
 *
 * Câu quan trọng nhất ở đây là câu TỪ CHỐI. Bảo vệ đứng ở cửa, có người đang
 * chờ trước mặt, và cái họ cần không phải là "mã không hợp lệ" mà là biết nên
 * bảo khách chờ, gọi lên căn hộ, hay mời ra.
 */

export type TrangThaiKhach =
  | 'dang_hieu_luc' | 'trong_toa' | 'quen_quet_ra' | 'da_ra'
  | 'chua_toi_gio' | 'het_han' | 'thu_hoi' | 'khong_co'

export const NHAN_TRANG_THAI: Record<string, string> = {
  dang_hieu_luc: 'Đang hiệu lực',
  trong_toa: 'Đang trong tòa',
  quen_quet_ra: 'Chưa quét ra',
  da_ra: 'Đã ra',
  chua_toi_gio: 'Chưa tới giờ',
  het_han: 'Hết hạn',
  thu_hoi: 'Đã thu hồi',
  khong_co: 'Không có mã này',
}

export const nhanTrangThai = (t: string) => NHAN_TRANG_THAI[t] ?? t

export const TONE_TRANG_THAI: Record<string, 'tot' | 'canh' | 'xau' | 'trung'> = {
  dang_hieu_luc: 'tot',
  trong_toa: 'tot',
  // Không xanh: một lượt quá giờ hẹn mà chưa quét ra gần như chắc chắn là khách
  // đã về, chứ không phải khách còn ở đây. Để nó cùng màu với người đang thật
  // sự trong tòa là làm con số "đang trong tòa" mất nghĩa dần theo tháng.
  quen_quet_ra: 'canh',
  da_ra: 'trung',
  chua_toi_gio: 'canh',
  het_han: 'xau',
  thu_hoi: 'xau',
  khong_co: 'xau',
}

/**
 * Việc bảo vệ phải làm, ứng với từng lý do từ chối. Không có câu này thì màn
 * quét chỉ nói được là "không" — mà "không" xong thì bảo vệ vẫn phải tự nghĩ ra
 * bước tiếp theo, trước mặt người đang chờ.
 */
export function viecPhaiLam(trangThai: string): string | null {
  switch (trangThai) {
    case 'chua_toi_gio':
      return 'Mời khách chờ tới giờ hẹn, hoặc gọi lên căn hộ nhờ cư dân dời giờ.'
    case 'het_han':
      return 'Gọi lên căn hộ. Cư dân mời lại một lượt mới là quét được ngay.'
    case 'thu_hoi':
      return 'Cư dân đã hủy lượt này. KHÔNG cho vào — gọi lên căn hộ trước.'
    case 'da_ra':
      return 'Lượt này đã dùng xong. Muốn vào lại thì cư dân mời lượt mới.'
    case 'quen_quet_ra':
      return 'Lượt này quá giờ hẹn mà chưa ghi giờ ra. Gặp lại khách thì quét để đóng sổ.'
    case 'khong_co':
      return 'Kiểm lại xem có quét đúng mã không. Mã khách khác mã thẻ cư dân.'
    default:
      return null
  }
}

const gioVN = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))

const ngayVNso = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso))

/**
 * "14:00–18:00 hôm nay" khi cùng ngày, "14:00 03/09 – 09:00 04/09" khi qua đêm.
 *
 * Gộp thành một dạng duy nhất có ngày đầy đủ thì dạng thường gặp nhất — khách
 * tới chơi một buổi chiều — đọc dài gấp đôi cần thiết. Bỏ hẳn ngày thì lượt qua
 * đêm đọc thành "22:00–06:00" và không ai biết 06:00 là sáng nào.
 */
export function khoangGio(tu: string, den: string, homNay?: Date): string {
  const nTu = ngayVNso(tu)
  const nDen = ngayVNso(den)
  const nNay = ngayVNso((homNay ?? new Date()).toISOString())
  const ngayGon = (n: string) => `${n.slice(8, 10)}/${n.slice(5, 7)}`

  if (nTu === nDen) {
    const khi = nTu === nNay ? 'hôm nay' : ngayGon(nTu)
    return `${gioVN(tu)}–${gioVN(den)} ${khi}`
  }
  return `${gioVN(tu)} ${ngayGon(nTu)} – ${gioVN(den)} ${ngayGon(nDen)}`
}

/** Ngưỡng kế hoạch tháng 1 đặt ra để bảo vệ bỏ được sổ giấy song song. */
export const NGUONG_BO_SO_GIAY = 50

export function loiSoGiay(tyLe: number, tongCan: number, canCoNguoi: number) {
  if (tongCan === 0) {
    return { ok: false as const, tieu: 'Chưa có căn hộ nào', than: 'Nhập danh sách căn trước đã.' }
  }
  if (tyLe >= NGUONG_BO_SO_GIAY) {
    return {
      ok: true as const,
      tieu: `${canCoNguoi}/${tongCan} căn đã có người dùng app`,
      than:
        `Trên ngưỡng ${NGUONG_BO_SO_GIAY}% — bảo vệ bỏ được sổ giấy. Khách của những căn ` +
        'chưa dùng app vẫn phải ghi tay, nên giữ một quyển dự phòng ở chốt.',
    }
  }
  return {
    ok: false as const,
    tieu: `Mới ${canCoNguoi}/${tongCan} căn có người dùng app`,
    than:
      `Dưới ngưỡng ${NGUONG_BO_SO_GIAY}%, bảo vệ VẪN PHẢI giữ sổ giấy song song. ` +
      'Bỏ sớm là phần lớn lượt khách không được ghi ở đâu cả — tệ hơn hẳn sổ giấy.',
  }
}

/** Tin nhắn cư dân gửi cho khách qua Zalo. */
export function loiMoi(hoTen: string, can: string, toa: string, tu: string, den: string) {
  return (
    `Mời ${hoTen} tới ${can} (${toa}). ` +
    `Hiệu lực ${khoangGio(tu, den)}. ` +
    'Đưa mã QR trong link cho bảo vệ quét ở sảnh.'
  )
}
