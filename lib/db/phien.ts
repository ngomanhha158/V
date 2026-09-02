/**
 * Cookie phiên đăng nhập. Tách riêng khỏi lib/db/server.ts vì middleware cũng
 * cần đúng tên và đúng tùy chọn này, mà middleware không import được
 * `next/headers`.
 *
 * httpOnly là chốt chính: JavaScript trong trang KHÔNG đọc được token. Đây là
 * khác biệt cố ý so với Supabase, bên đó token nằm trong localStorage cho
 * trình duyệt gọi thẳng API — mà app này thì không có đường nào từ trình duyệt
 * xuống PostgREST cả, mọi truy vấn đều đi qua máy chủ Next. Không cần đọc thì
 * không mở, và một lỗi XSS ở bất kỳ trang nào cũng không lấy được phiên.
 */
export const TEN_COOKIE = 'vb_phien'

export function tuyChonCookie(songGiay: number) {
  return {
    httpOnly: true,
    // sameSite lax chứ không phải strict: link trong email đăng nhập trỏ ngược
    // về app, strict thì cookie không được gửi kèm ở bước điều hướng đó và
    // người ta bấm link xong vẫn thấy màn đăng nhập.
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: songGiay,
  }
}
