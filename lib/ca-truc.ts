/**
 * Ca trực và biên bản bàn giao ca — chữ nghĩa dùng chung giữa các màn.
 *
 * Con số đáng nói nhất ở đây không phải "đã bàn giao mấy lần" mà là ĐÃ CHỜ KÝ
 * BAO LÂU. Một biên bản viết xong rồi nằm đó không ai ký nghĩa là ca sau đang
 * làm việc mà chưa đọc gì của ca trước — đúng cái hỏng mà tính năng này dựng
 * lên để chặn, chỉ khác là bây giờ nó nhìn thấy được.
 */

export type MucCho = 'moi' | 'lau' | 'qua_lau'

/**
 * Ba mức, cắt theo độ dài một ca chứ không theo số tròn.
 *
 * Dưới 1 giờ là bình thường — người nhận ca còn đang đi vòng kiểm tra. Quá 4
 * giờ là đã qua một phần ba ca mà vẫn chưa ai đọc. Quá 12 giờ là gần hết một
 * ca: biên bản đó coi như chưa từng tới tay ai.
 */
export function mucCho(gio: number): MucCho {
  if (gio >= 12) return 'qua_lau'
  if (gio >= 4) return 'lau'
  return 'moi'
}

export const NHAN_CHO: Record<MucCho, string> = {
  moi: 'Vừa bàn giao',
  lau: 'Chờ ký đã lâu',
  qua_lau: 'Gần hết ca mà chưa ai ký',
}

export const TONE_CHO: Record<MucCho, 'tot' | 'canh' | 'xau' | 'trung'> = {
  moi: 'trung',
  lau: 'canh',
  qua_lau: 'xau',
}

/** "3 giờ 20 phút" — giờ lẻ đọc bằng chữ, vì 3,3 giờ thì phải tự nhẩm. */
export function loiThoiGian(gio: number): string {
  if (gio < 1) {
    const phut = Math.max(1, Math.round(gio * 60))
    return `${phut} phút`
  }
  const g = Math.floor(gio)
  const phut = Math.round((gio - g) * 60)
  return phut === 0 ? `${g} giờ` : `${g} giờ ${phut} phút`
}

/**
 * Ca qua đêm hay không, suy ra từ giờ chứ không lưu thêm một cột.
 *
 * Hai cột nói cùng một chuyện là hai cột sẽ lệch nhau: ai đó sửa giờ kết thúc
 * mà quên bỏ tick "qua đêm", và lịch trực hiện sai từ hôm đó.
 */
export function quaDem(batDau: string, ketThuc: string): boolean {
  return ketThuc <= batDau
}

/** "18:00 – 06:00 (qua đêm)" */
export function loiGioCa(batDau: string, ketThuc: string): string {
  const g = (t: string) => t.slice(0, 5)
  return `${g(batDau)} – ${g(ketThuc)}${quaDem(batDau, ketThuc) ? ' (qua đêm)' : ''}`
}

/**
 * Câu nói tình trạng của một phiên trực đang mở: đã trực bao lâu.
 *
 * Người trực quá dài là một rủi ro vận hành thật — và cũng thường là dấu hiệu
 * người ta quên bấm kết ca, làm mọi con số bên dưới sai theo.
 */
export function loiDangTruc(vaoLuc: string, bayGio = Date.now()) {
  const gio = (bayGio - new Date(vaoLuc).getTime()) / 3_600_000
  if (gio > 14) {
    return {
      tone: 'xau' as const,
      loi: `Đã trực ${loiThoiGian(gio)} — dài hơn mọi ca thường, nhiều khả năng là quên bấm kết ca.`,
    }
  }
  if (gio < 0) {
    // Đồng hồ máy chủ và đồng hồ trình duyệt lệch nhau vài giây là chuyện
    // thường; hiện "đã trực -1 phút" thì người dùng mất tin vào cả màn hình.
    return { tone: 'trung' as const, loi: 'Vừa vào ca.' }
  }
  return { tone: 'trung' as const, loi: `Đã trực ${loiThoiGian(gio)}.` }
}

export const NHAN_TRANG_THAI_YC: Record<string, string> = {
  new: 'Mới',
  assigned: 'Đã giao',
  in_progress: 'Đang làm',
  resolved: 'Đã xong',
  closed: 'Đã đóng',
  rejected: 'Từ chối',
}

export const NHAN_MUC_DO: Record<string, string> = {
  urgent: 'Khẩn',
  high: 'Cao',
  normal: 'Thường',
  low: 'Thấp',
}

export const TONE_MUC_DO: Record<string, 'tot' | 'canh' | 'xau' | 'trung'> = {
  urgent: 'xau',
  high: 'canh',
  normal: 'trung',
  low: 'trung',
}

/**
 * Có bàn giao được không, và nếu không thì vì sao.
 *
 * Màn hình phải trả lời câu này TRƯỚC khi người ta gõ xong tình hình ca rồi mới
 * bị chặn. Lý do phổ biến nhất — "ca sau chưa ai vào" — cũng chính là một sự cố
 * vận hành, nên nó phải đọc như một sự cố chứ không như một lỗi thao tác.
 */
export function coBanGiaoDuoc(
  phienCuaToi: { phien_id: string } | null,
  nguoiKhacDangTruc: { phien_id: string }[],
): { duoc: boolean; loi: string } {
  if (!phienCuaToi) {
    return { duoc: false, loi: 'Bạn chưa vào ca nào. Vào ca trước rồi mới bàn giao được.' }
  }
  if (nguoiKhacDangTruc.length === 0) {
    return {
      duoc: false,
      loi:
        'Chưa ai của ca sau vào ca, nên chưa bàn giao cho ai được. Đây là một sự cố '
        + 'vận hành chứ không phải lỗi thao tác: gọi người ca sau, hoặc kết ca kèm lý do '
        + 'để dòng đó nằm lại trong sổ.',
    }
  }
  return { duoc: true, loi: '' }
}
