import { NextResponse } from 'next/server'

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

export function GET() {
  return NextResponse.json({ ok: true, at: new Date().toISOString(), ban: BAN_BUILD })
}
