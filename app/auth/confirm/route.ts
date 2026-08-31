import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Đích đến của LINK trong email đăng nhập.
 *
 * Vì sao cần route này khi màn đăng nhập đã có ô nhập mã 6 số: mẫu email mặc
 * định của Supabase chỉ có LINK, không có mã. Muốn có mã thì phải sửa mẫu email
 * trong dashboard để thêm {{ .Token }}. Có route này thì cả hai đường đều vào
 * được — chưa sửa mẫu thì bấm link, sửa rồi thì gõ mã — và người dùng không
 * bao giờ rơi vào cảnh "email không có mã mà app thì đòi mã".
 *
 * Route Handler chứ không phải Server Component vì ở đây PHẢI ghi được cookie
 * phiên đăng nhập; Server Component thì không.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  // Chỉ nhận đường dẫn nội bộ. Thiếu chốt này thì link email thành bàn đạp
  // chuyển hướng người dùng sang trang bất kỳ — kẻ lừa đảo rất thích.
  const dich = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?loi=thieu_ma', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash })
  if (error) {
    // Link hết hạn hoặc đã dùng rồi. Nói ra ở màn đăng nhập, đừng để trang trắng.
    return NextResponse.redirect(new URL('/login?loi=het_han', origin))
  }

  return NextResponse.redirect(new URL(dich, origin))
}
