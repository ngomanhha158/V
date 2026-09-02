import { type NextRequest, NextResponse } from 'next/server'
import { normalizeEmail, toE164VN } from '@/lib/phone'
import { guiMa } from '@/lib/db/dang-nhap'

/**
 * Xin mã đăng nhập một lần.
 *
 * Chuẩn hóa LẠI ở đây dù màn đăng nhập đã chuẩn hóa rồi: đây là endpoint công
 * khai, ai cũng POST thẳng vào được, và "trình duyệt đã làm rồi" chưa bao giờ
 * là một chốt chặn.
 */
export async function POST(request: NextRequest) {
  let than: unknown
  try {
    than = await request.json()
  } catch {
    return NextResponse.json({ tt: 'la' }, { status: 400 })
  }
  const tho = String((than as { danhTinh?: unknown })?.danhTinh ?? '').trim()

  if (!tho.includes('@')) {
    // Số điện thoại: chưa có nhà cung cấp SMS. Nói thẳng và chỉ lối khác, đừng
    // trả 'ok' rồi để người ta ngồi chờ một tin nhắn không bao giờ tới.
    return NextResponse.json({ tt: toE164VN(tho) ? 'chua_co_sms' : 'la' })
  }
  const email = normalizeEmail(tho)
  if (!email) return NextResponse.json({ tt: 'la' })

  // Gốc lấy từ chính request để link trong thư trỏ đúng tên miền đang dùng —
  // cùng một bản build chạy được ở cả máy dev lẫn Railway mà không cần thêm
  // biến môi trường nào để rồi quên cập nhật.
  const goc = request.nextUrl.origin
  return NextResponse.json(await guiMa(email, goc))
}
