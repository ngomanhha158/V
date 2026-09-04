import { NextResponse, type NextRequest } from 'next/server'
import { doc, ky } from '@/lib/db/jwt'
import { biMatJwt, kiemCauHinh, PHIEN_GIA_HAN_GIAY, PHIEN_SONG_GIAY } from '@/lib/db/env'
import { TEN_COOKIE, tuyChonCookie } from '@/lib/db/phien'

export async function middleware(request: NextRequest) {
  // Bản demo thoát ra TRƯỚC khi đọc bí mật ký token — hai lý do:
  // 1. /demo cố ý bỏ qua đăng nhập, không đá về /login.
  // 2. Quan trọng hơn: biMatJwt() ném lỗi khi thiếu biến môi trường. Máy chưa
  //    cấu hình thì middleware văng và CẢ APP trắng màn, kể cả trang demo.
  //    Thoát sớm ở đây để `npm run dev` xem được giao diện mà không cần bất kỳ
  //    khóa nào.
  // An toàn vì app/demo chỉ đọc dữ liệu giả cứng trong lib/demo/data.ts,
  // không có đường nào ra database thật.
  //
  // /api/webhook/* và /api/cron/* thoát ra ở ĐÚNG CHỖ NÀY vì cùng lý do (2),
  // và vì một lý do nặng hơn: cả hai được gọi từ MÁY, không phải từ người —
  // ngân hàng bắn giao dịch sang, Railway Cron Service gọi job nền, không bên
  // nào có cookie. Chốt chặn của chúng là bí mật dùng chung kiểm trong route
  // handler. Bắt chúng đi qua vòng kiểm phiên là mọi lần gọi đều bị đá về
  // /login: tiền của cư dân biến mất khỏi hệ thống, và job nền im lặng không
  // chạy suốt nhiều tháng.
  const duong = request.nextUrl.pathname
  if (duong.startsWith('/demo') || duong.startsWith('/api/webhook/')
      || duong.startsWith('/api/cron/')) {
    return NextResponse.next({ request })
  }

  // SOÁT CẤU HÌNH TRƯỚC KHI CHẠM VÀO BÍ MẬT. Thiếu biến môi trường thì
  // biMatJwt() ném lỗi ngay dòng dưới, và Next biến nó thành đúng ba chữ
  // "Internal Server Error" — người đang dựng hệ thống nhìn ba chữ đó thì không
  // biết bắt đầu từ đâu, trong khi câu hướng dẫn đã viết sẵn ở lib/db/env.ts.
  // Đưa họ sang màn nói rõ THIẾU BIẾN NÀO.
  if (duong !== '/loi-cau-hinh' && kiemCauHinh().length > 0) {
    return NextResponse.rewrite(new URL('/loi-cau-hinh', request.url))
  }

  const claims = await doc(request.cookies.get(TEN_COOKIE)?.value, biMatJwt())

  // Cổng mở:
  //  • /login, /auth/*   — người chưa có phiên phải vào được, đó là cả mục đích
  //  • /api/auth/*       — chính là mấy endpoint cấp phiên
  //  • /api/health       — Railway gọi không kèm cookie; bị đá về /login thì
  //                        health check trượt và deploy không bao giờ xanh
  const congMo = duong === '/login' || duong.startsWith('/auth/')
    || duong.startsWith('/api/auth/') || duong === '/api/health'

  if (!claims) {
    if (congMo) return NextResponse.next({ request })
    // Cookie hỏng hoặc hết hạn thì DỌN luôn, đừng để nó nằm lại: một cookie
    // chết mà còn đó là mỗi request đều tốn một lần kiểm chữ ký để rồi vứt đi,
    // và người dùng thì thấy mình "đăng nhập rồi" cho tới lúc bấm vào đâu đó.
    const di = NextResponse.redirect(new URL('/login', request.url))
    if (request.cookies.has(TEN_COOKIE)) di.cookies.delete(TEN_COOKIE)
    return di
  }

  // Đã đăng nhập mà vào /login thì đưa thẳng về nhà. Không có dòng này thì
  // người đang dùng app bấm nhầm link cũ sẽ thấy màn đăng nhập và tưởng mình
  // bị đá ra.
  if (duong === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const response = NextResponse.next({ request })

  // Gia hạn trượt: còn dưới 7 ngày thì cấp token mới. Người dùng thường xuyên
  // không bao giờ rơi ra, còn tài khoản bỏ quên thì vẫn hết hạn sau 30 ngày.
  // Ký lại ở MỌI request là ký hàng nghìn lần một ngày cho cùng một người,
  // nên chỉ ký khi sắp hết.
  const conLai = claims.exp - Math.floor(Date.now() / 1000)
  if (conLai < PHIEN_GIA_HAN_GIAY) {
    const moi = await ky(claims.sub, claims.role, biMatJwt(), PHIEN_SONG_GIAY)
    response.cookies.set(TEN_COOKIE, moi, tuyChonCookie(PHIEN_SONG_GIAY))
  }
  return response
}

// manifest.webmanifest / sw.js / offline.html phải LOẠI KHỎI matcher, không
// phải xử lý bên trong middleware: cư dân vừa quét poster thì CHƯA đăng nhập,
// mà trình duyệt vẫn phải tải được manifest và service worker để hiện nút cài
// app. Để chúng đi qua vòng kiểm phiên là bị đá về /login, trình duyệt nhận
// một trang HTML thay cho JSON manifest, và nút "Thêm vào MH chính" không bao
// giờ xuất hiện — hỏng đúng ở nhóm người mà cả PWA sinh ra để phục vụ.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\.js|offline\.html|.*\.(?:svg|png|jpg|webp)$).*)',
  ],
}
