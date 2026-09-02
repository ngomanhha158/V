import { type NextRequest, NextResponse } from 'next/server'
import { dongPhien } from '@/lib/db/dang-nhap'

/**
 * Đăng xuất.
 *
 * POST chứ không phải GET: một đường /dang-xuat mở bằng GET là bất kỳ trang
 * nào cũng nhúng được <img src="..."> để đá người ta ra khỏi phiên.
 *
 * Xóa cookie là đủ để đóng phiên trên máy này. Token đã cấp vẫn còn hạn chữ ký
 * cho tới lúc hết hạn — đó là cái giá của JWT không trạng thái. Cần rút phiên
 * của TẤT CẢ mọi người ngay lập tức thì đổi AUTH_JWT_SECRET rồi deploy lại.
 */
export async function POST(request: NextRequest) {
  await dongPhien()
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
}
