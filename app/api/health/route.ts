import { NextResponse } from 'next/server'

/**
 * Health check cho Railway.
 *
 * CỐ Ý không chạm Supabase. Health check dùng để trả lời "tiến trình này còn
 * sống không", không phải "mọi thứ phụ thuộc còn sống không". Nếu nó gọi DB
 * thì một sự cố bên Supabase sẽ làm Railway tưởng app hỏng, giết container và
 * chặn mọi lần deploy sau — biến một sự cố ngoài tầm tay thành sự cố của mình.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ ok: true, at: new Date().toISOString() })
}
