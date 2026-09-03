/**
 * Đặt tiện ích — phần chữ nghĩa dùng chung giữa màn cư dân và màn BQL.
 *
 * Bài học từ màn chỗ đỗ xe: đừng viết "1/2". Người đọc không biết 1 là đã dùng
 * hay còn lại, và đoán sai thì họ hoặc bỏ lỡ suất cuối, hoặc đi báo BQL là hệ
 * thống hỏng.
 */

export type OSuat = {
  suat_id: string
  thu_tu: number
  bat_dau: string
  ket_thuc: string
  con_trong: boolean
  cua_toi: boolean
  dong_cua: boolean
  ly_do: string | null
}

/** '18:00:00' → '18:00'. Postgres trả về `time` kèm giây, màn hình không cần. */
export const gio = (t: string) => t.slice(0, 5)

export const nhanSuat = (batDau: string, ketThuc: string) =>
  `${gio(batDau)}–${gio(ketThuc)}`

export type TinhNgay = 'trong' | 'con_it' | 'kin' | 'dong'

/**
 * Màu của một ô ngày trên lịch. Ngày bị đóng hoàn toàn KHÁC ngày kín chỗ: một
 * cái là "hết người khác đặt rồi", cái kia là "hôm nay không mở cửa" — và người
 * đọc phản ứng khác nhau với hai điều đó.
 */
export function tinhNgay(o: OSuat[]): TinhNgay {
  if (o.length === 0) return 'dong'
  if (o.every((x) => x.dong_cua)) return 'dong'
  const trong = o.filter((x) => x.con_trong).length
  if (trong === 0) return 'kin'
  if (trong === 1) return 'con_it'
  return 'trong'
}

export const TONE_NGAY: Record<TinhNgay, 'tot' | 'canh' | 'xau' | 'trung'> = {
  trong: 'tot',
  con_it: 'canh',
  kin: 'xau',
  dong: 'trung',
}

export const NHAN_NGAY: Record<TinhNgay, string> = {
  trong: 'còn chỗ',
  con_it: 'còn 1 suất',
  kin: 'kín',
  dong: 'đóng',
}

/**
 * Hạn mức tuần, viết bằng lời. "1/2" thì người đọc không biết 1 là đã dùng hay
 * còn lại; và lúc hết suất phải nói luôn BAO GIỜ đặt lại được, chứ không chỉ
 * nói là hết.
 */
export function loiConSuat(daDat: number, toiDa: number, conLai: number) {
  if (conLai > 0) {
    return {
      ok: true as const,
      loi: `Căn bạn còn ${conLai} suất trong tuần này (đã đặt ${daDat} trên ${toiDa}).`,
    }
  }
  return {
    ok: false as const,
    loi:
      `Căn bạn đã dùng hết ${toiDa} suất của tuần này. ` +
      'Sang thứ Hai là đặt lại được — hoặc hủy một suất chưa tới giờ để lấy lại chỗ.',
  }
}

/**
 * Vì sao một ô không bấm được. Mỗi lý do một câu khác nhau: gộp thành "không
 * đặt được" là người ta thử lại ô khác rồi lại thử ô khác, không hiểu vì sao.
 */
export function loiOKhongDat(o: OSuat, conSuat: boolean, quaXa: boolean): string | null {
  if (o.dong_cua) return `Ban quản lý đóng suất này — ${o.ly_do || 'không ghi lý do'}.`
  if (o.cua_toi) return 'Căn bạn đang giữ suất này.'
  if (!o.con_trong) return 'Có căn khác đặt trước rồi.'
  if (quaXa) return 'Chưa mở đặt cho ngày này.'
  if (!conSuat) return 'Căn bạn đã dùng hết suất của tuần này.'
  return null
}
