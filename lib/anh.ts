import { randomBytes } from 'node:crypto'

/**
 * Kho ảnh hỏng hóc, thay Supabase Storage.
 *
 * Ảnh nằm trên đĩa của service `v`, dưới ANH_DIR. Trên Railway đường dẫn đó
 * PHẢI là một Volume gắn vào service — filesystem của container là tạm, không
 * có volume thì mọi ảnh biến mất ở lần deploy kế tiếp, lặng lẽ, và chỉ lộ ra
 * lúc có người mở lại một yêu cầu cũ để đối chất.
 */
export const ANH_TOI_DA = 5 * 1024 * 1024
export const KIEU_CHO_PHEP = ['image/jpeg', 'image/png', 'image/webp'] as const

const DUOI: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
}

export function thuMuc(): string {
  return process.env.ANH_DIR
    ?? (process.env.NODE_ENV === 'production' ? '/data/ticket-photos' : '.anh')
}

/**
 * Đường dẫn lưu: {unit_id}/{ngẫu nhiên}.{đuôi}
 *
 * TÊN DO MÁY CHỦ ĐẶT, không lấy tên file người dùng gửi lên. Tên gốc mang theo
 * dấu chấm, dấu gạch chéo, ký tự unicode nhìn giống dấu gạch chéo — và mỗi thứ
 * đó là một cách để ghi đè lên một file khác trên đĩa.
 */
export function duongMoi(unitId: string, mime: string): string {
  return `${unitId}/${randomBytes(16).toString('hex')}.${DUOI[mime] ?? 'jpg'}`
}

/**
 * Đường dẫn có đúng khuôn do chính mình sinh ra không.
 *
 * Chốt chặn leo thư mục. Kiểm bằng KHUÔN CHO PHÉP chứ không phải bằng danh
 * sách cấm: danh sách cấm ('..', '/', '%2e%2e') luôn thiếu một biến thể nào đó,
 * còn khuôn thì chỉ nhận đúng cái mình biết là an toàn.
 */
const KHUON = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{32}\.(jpg|png|webp)$/

export function hopLeDuong(d: string): boolean {
  return KHUON.test(d)
}

export function kieuTheoDuong(d: string): string {
  const duoi = d.slice(d.lastIndexOf('.') + 1)
  return duoi === 'png' ? 'image/png' : duoi === 'webp' ? 'image/webp' : 'image/jpeg'
}
