import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
import { hopLeDuong, kieuTheoDuong, thuMuc } from '@/lib/anh'

/**
 * Xem ảnh hỏng hóc. Thay `createSignedUrls()`.
 *
 * Cố ý KHÔNG dùng URL có chữ ký hạn một giờ như Supabase: chữ ký nghĩa là ai
 * cầm được đường link đó — chuyển tiếp trong nhóm chat chẳng hạn — thì xem
 * được, và thu hồi quyền của một người không có tác dụng cho tới khi chữ ký
 * hết hạn. Ở đây quyền được hỏi lại TỪNG LẦN xem.
 *
 * Và câu hỏi là "có đọc được cái YÊU CẦU chứa ảnh này không", không phải "ảnh
 * này thuộc căn nào". Quy tắc ai xem được yêu cầu nào đã nằm trong RLS của
 * bảng tickets rồi; chép lại nó ở đây là chép ra một bản sao sẽ lệch.
 */
export async function GET(
  _request: NextRequest, ctx: { params: Promise<{ duong: string[] }> },
) {
  const duong = (await ctx.params).duong.join('/')
  // Kiểm khuôn TRƯỚC khi chạm vào đĩa. Đây là chốt chặn leo thư mục.
  if (!hopLeDuong(duong)) return new NextResponse(null, { status: 404 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('tickets').select('id').contains('photo_urls', [duong]).limit(1).maybeSingle()
  // 404 chứ không phải 403: nói "cấm" là xác nhận file đó có thật.
  if (!data) return new NextResponse(null, { status: 404 })

  let anh: Buffer
  try {
    anh = await readFile(join(thuMuc(), duong))
  } catch {
    return new NextResponse(null, { status: 404 })
  }

  return new NextResponse(new Uint8Array(anh), {
    headers: {
      'content-type': kieuTheoDuong(duong),
      // private: proxy dùng chung không được giữ lại. max-age ngắn để mở lại
      // trang không tải lại ảnh, mà thu hồi quyền cũng có hiệu lực gần như ngay.
      'cache-control': 'private, max-age=60',
      'content-disposition': 'inline',
    },
  })
}
