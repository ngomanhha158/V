import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Mã thẻ cư dân: một chuỗi ngắn, ký bằng HMAC, sống 60 giây.
 *
 * KHÔNG dùng JWT, và đó là quyết định có chủ ý ở hai mặt:
 *
 * 1. AN TOÀN. Token phiên đăng nhập cũng ký bằng AUTH_JWT_SECRET. Nếu mã thẻ
 *    cũng là một JWT thì ai chụp được ảnh mã QR sẽ cầm trong tay một phiên đăng
 *    nhập hợp lệ của cư dân đó — PostgREST nhận nó không hỏi gì thêm. Ở đây mã
 *    thẻ là 52 byte nhị phân, không có dấu chấm, không tách được thành ba phần:
 *    doc() của lib/db/jwt.ts từ chối nó ngay ở bước đếm phần, và ngược lại
 *    docThe() từ chối mọi JWT vì sai độ dài. Hai chiều đều đóng bằng HÌNH DẠNG
 *    chứ không bằng một quy ước tên claim mà người sau có thể vô tình phá.
 *    Thêm một lớp nữa: chuỗi phân tách miền ở đầu dữ liệu ký, nên cùng một khóa
 *    cũng không thể sinh ra hai chữ ký trùng nhau giữa hai công dụng.
 *
 * 2. QUÉT ĐƯỢC THẬT. Một JWT nhét vào URL cho ra mã QR cỡ 57×57 ô. Bảo vệ cầm
 *    điện thoại cũ, đứng ở sảnh thiếu sáng, soi màn hình cư dân đang bị chói —
 *    mỗi ô nhỏ đi là một lần quét lại. Dạng gọn này cho QR cỡ 41×41, các ô to
 *    hơn gấp rưỡi.
 *
 * Thu hồi KHÔNG nằm ở mã. Mã chỉ nói "người này, căn này, còn trong 60 giây".
 * Còn "có được vào không" thì hàm kiem_the() hỏi lại database mỗi lần quét, nên
 * hợp đồng thuê chấm dứt là thẻ chết ngay, không phải chờ mã hết hạn.
 */

const MIEN = 'vbuilding:the-cu-dan:v1'
const DAI_KY = 16          // 128 bit chữ ký — đủ, và ngắn thì QR thưa hơn
const DAI_THAN = 36        // 16 (người) + 16 (căn) + 4 (hạn)

export const THE_SONG_GIAY = 60

const bo = (uuid: string) => Buffer.from(uuid.replace(/-/g, ''), 'hex')

function veUuid(b: Buffer): string {
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const chuKy = (than: Buffer, biMat: string) =>
  createHmac('sha256', biMat).update(MIEN).update(than).digest().subarray(0, DAI_KY)

export function kyThe(
  uid: string, unit: string, biMat: string,
  songGiay: number = THE_SONG_GIAY, bay: number = Date.now(),
): string {
  const than = Buffer.alloc(DAI_THAN)
  bo(uid).copy(than, 0)
  bo(unit).copy(than, 16)
  than.writeUInt32BE(Math.floor(bay / 1000) + songGiay, 32)
  return Buffer.concat([than, chuKy(than, biMat)]).toString('base64url')
}

export type The = { uid: string; unit: string; hetHan: number }

/** Trả null nếu sai hình dạng, sai chữ ký, hoặc hết hạn. Không bao giờ trả về
 *  nội dung của một mã chưa kiểm chữ ký — phần thân là base64 chứ không phải
 *  mật mã, ai cũng sửa được số căn thành căn khác. */
export function docThe(
  ma: string | undefined | null, biMat: string, bay: number = Date.now(),
): The | null {
  if (!ma) return null
  // Chặn trước khi giải mã: base64url không có dấu chấm, JWT thì luôn có.
  if (!/^[A-Za-z0-9_-]+$/.test(ma)) return null
  let raw: Buffer
  try {
    raw = Buffer.from(ma, 'base64url')
  } catch {
    return null
  }
  if (raw.length !== DAI_THAN + DAI_KY) return null

  const than = raw.subarray(0, DAI_THAN)
  const ky = raw.subarray(DAI_THAN)
  if (!timingSafeEqual(ky, chuKy(than, biMat))) return null

  const hetHan = than.readUInt32BE(32)
  if (hetHan * 1000 <= bay) return null
  return { uid: veUuid(than.subarray(0, 16)), unit: veUuid(than.subarray(16, 32)), hetHan }
}
