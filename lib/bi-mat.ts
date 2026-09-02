import { timingSafeEqual } from 'node:crypto'

/**
 * So hai chuỗi bí mật mà không rò rỉ qua thời gian chạy.
 *
 * `a === b` dừng ngay ở ký tự đầu tiên khác nhau, nên thời gian trả lời cho
 * biết kẻ dò đã đoán đúng bao nhiêu ký tự đầu. Chênh lệch cỡ nano giây, nhưng
 * đo được qua mạng nếu người ta chịu khó bắn vài triệu lần — và một endpoint
 * webhook hay cron thì bắn bao nhiêu cũng được, không ai ngồi nhìn.
 */
export function bangNhau(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  // timingSafeEqual ném lỗi khi khác độ dài, mà bản thân việc ném lỗi cũng là
  // rò rỉ. Đệm về cùng độ dài rồi mới so, và kiểm tra độ dài như một điều kiện.
  const n = Math.max(x.length, y.length, 1)
  const px = Buffer.alloc(n)
  const py = Buffer.alloc(n)
  x.copy(px); y.copy(py)
  return timingSafeEqual(px, py) && x.length === y.length
}
