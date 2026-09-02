import { type NextRequest, NextResponse } from 'next/server'
import { normalizeEmail } from '@/lib/phone'
import { moPhien, vaoBangMa } from '@/lib/db/dang-nhap'

/**
 * Đích đến của LINK trong thư đăng nhập.
 *
 * Vì sao cần route này khi màn đăng nhập đã có ô nhập mã: người mở thư trên
 * điện thoại thì bấm link nhanh hơn gõ sáu chữ số, còn người đọc thư trên máy
 * tính rồi đăng nhập ở điện thoại thì phải gõ mã. Có cả hai đường thì không ai
 * kẹt.
 *
 * Link mang đúng cái mã trong thư, không phải một bí mật thứ hai: một bí mật
 * là một chỗ để hết hạn, một chỗ để đếm lượt, một chỗ để sai.
 *
 * Route Handler chứ không phải Server Component vì ở đây PHẢI ghi được cookie
 * phiên đăng nhập; Server Component thì không.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const email = normalizeEmail(searchParams.get('dt') ?? '')
  const ma = (searchParams.get('ma') ?? '').trim()
  const next = searchParams.get('next') ?? '/'

  // Chỉ nhận đường dẫn nội bộ. Thiếu chốt này thì link thư thành bàn đạp
  // chuyển hướng người dùng sang trang bất kỳ — kẻ lừa đảo rất thích.
  const dich = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (!email || !ma) {
    return NextResponse.redirect(new URL('/login?loi=thieu_ma', origin))
  }

  const kq = await vaoBangMa(email, ma)
  if (!kq.ok) {
    // Link hết hạn hoặc đã dùng rồi. Nói ra ở màn đăng nhập, đừng để trang trắng.
    return NextResponse.redirect(new URL(`/login?loi=${kq.tt}`, origin))
  }

  await moPhien(kq.uid)
  return NextResponse.redirect(new URL(dich, origin))
}
