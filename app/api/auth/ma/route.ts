import { type NextRequest, NextResponse } from 'next/server'
import { goYNguoiSua, loiDangNhap } from '@/lib/auth-loi'
import { normalizeEmail, toE164VN } from '@/lib/phone'
import { guiMa } from '@/lib/db/dang-nhap'

/** Như ở /api/auth/vao: gửi kèm CÂU CHỮ để tab đang giữ bản JS cũ vẫn hiện
 *  đúng thứ máy chủ muốn nói, thay vì rơi vào câu chung. */
function traLoi(tt: string, giay?: number, maLoi?: string) {
  return NextResponse.json({
    tt, giay, maLoi, cau: loiDangNhap(tt, giay ?? 0), goY: goYNguoiSua(tt),
  })
}

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
    return NextResponse.json({ tt: 'la', cau: loiDangNhap('la') }, { status: 400 })
  }
  const tho = String((than as { danhTinh?: unknown })?.danhTinh ?? '').trim()

  if (!tho.includes('@')) {
    // Số điện thoại: chưa có nhà cung cấp SMS. Nói thẳng và chỉ lối khác, đừng
    // trả 'ok' rồi để người ta ngồi chờ một tin nhắn không bao giờ tới.
    return traLoi(toE164VN(tho) ? 'chua_co_sms' : 'la')
  }
  const email = normalizeEmail(tho)
  if (!email) return traLoi('la')

  // Gốc lấy từ chính request để link trong thư trỏ đúng tên miền đang dùng —
  // cùng một bản build chạy được ở cả máy dev lẫn Railway mà không cần thêm
  // biến môi trường nào để rồi quên cập nhật.
  const goc = request.nextUrl.origin
  const kq = await guiMa(email, goc)
  // 'ok' không phải lỗi — không kèm câu chữ, để màn hình chuyển sang ô nhập mã.
  return kq.tt === 'ok' ? NextResponse.json(kq) : traLoi(kq.tt, kq.giay, kq.maLoi)
}
