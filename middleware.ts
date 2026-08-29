import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'

export async function middleware(request: NextRequest) {
  // Bản demo thoát ra TRƯỚC khi dựng client Supabase — hai lý do:
  // 1. /demo cố ý bỏ qua đăng nhập, không đá về /login.
  // 2. Quan trọng hơn: createServerClient bên dưới đọc biến môi trường bằng
  //    dấu `!`. Máy chưa cấu hình Supabase thì middleware ném lỗi và CẢ APP
  //    trắng màn, kể cả trang demo. Thoát sớm ở đây để `npm run dev` xem được
  //    giao diện mà không cần bất kỳ khóa nào.
  // An toàn vì app/demo chỉ đọc dữ liệu giả cứng trong lib/demo/data.ts,
  // không có đường nào ra database thật.
  if (request.nextUrl.pathname.startsWith('/demo')) return NextResponse.next({ request })

  const response = NextResponse.next({ request })
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)),
      },
    }
  )
  // Bắt buộc: refresh token hết hạn, nếu không Server Component sẽ thấy user đã logout.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  // /auth/confirm là đích của link trong email đăng nhập. Nó đến lúc người dùng
  // CHƯA có phiên — đó là cả mục đích của nó. Không mở đường ở đây thì link
  // email bị đá về /login và không ai đăng nhập được bằng link bao giờ.
  // /api/health phải đi qua TRƯỚC vòng kiểm đăng nhập: Railway gọi nó không
  // kèm cookie, bị đá về /login thì health check trượt và deploy không bao giờ
  // xanh.
  const congMo = path === '/login' || path.startsWith('/auth/') || path === '/api/health'
  if (!user && !congMo) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|webp)$).*)'],
}
