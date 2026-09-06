import { NextResponse } from 'next/server'
import { kiemCauHinh } from '@/lib/db/env'

/**
 * Health check cho Railway.
 *
 * CỐ Ý không chạm database. Health check dùng để trả lời "tiến trình này còn
 * sống không", không phải "mọi thứ phụ thuộc còn sống không". Nếu nó gọi
 * PostgREST thì một sự cố ở tầng dữ liệu sẽ làm Railway tưởng app hỏng, giết
 * container và chặn mọi lần deploy sau — biến một sự cố ở một service thành
 * sự cố của cả hai.
 */
export const dynamic = 'force-dynamic'

/**
 * Bản đang chạy là commit nào.
 *
 * Thiếu cái này thì câu "deploy lên chưa?" không có cách nào trả lời dứt điểm:
 * nhìn giao diện rồi đoán, mà giao diện lại có thể là tab cũ hoặc cache trình
 * duyệt. Đã mất một lần loay hoay vì chuyện đó.
 *
 * Railway tự đặt RAILWAY_GIT_COMMIT_SHA khi build. Chỉ trả 7 ký tự đầu — đủ
 * để nhận ra bản build, và không phải nguyên vẹn SHA của một repo riêng tư
 * trên một endpoint ai cũng gọi được.
 */
const BAN_BUILD = (process.env.RAILWAY_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'khong-ro'

/**
 * VẪN TRẢ 200 KHI THIẾU CẤU HÌNH — cố ý.
 *
 * Trả 5xx thì Railway giết container và không promote bản deploy nào nữa; lúc
 * đó không còn chỗ nào đọc được là thiếu biến gì, và người dựng hệ thống kẹt
 * cứng. Tiến trình VẪN đang sống, nên câu trả lời trung thực là 200 — kèm
 * đúng danh sách biến còn thiếu để người đọc biết ngay phải làm gì.
 *
 * Chỉ TÊN biến, không bao giờ giá trị. Tên vốn đã nằm trong .env.example.
 */
export function GET() {
  const thieu = kiemCauHinh()
  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    ban: BAN_BUILD,
    cau_hinh: thieu.length === 0 ? 'du' : 'thieu',
    ...(thieu.length > 0 ? { thieu } : {}),
  })
}
