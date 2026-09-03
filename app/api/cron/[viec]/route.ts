import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/db/admin'
import { bangNhau } from '@/lib/bi-mat'

/**
 * Job nền, gọi từ ngoài vào.
 *
 * Thay pg_cron. Ảnh Postgres của Railway không có extension đó, và chạy
 * cron.sql ở đấy thì đỏ ngay câu `create extension` — đỏ như vậy còn may. Cái
 * đáng sợ là tưởng nó chạy rồi: không có job nền thì hóa đơn không được nhắc,
 * ticket quá hạn không leo thang, hợp đồng thuê hết hạn không bị thu quyền.
 * Tất cả hỏng LẶNG LẼ, không màn nào báo, và chỉ lộ ra ở kỳ hóa đơn sau.
 *
 * Chốt chặn là CRON_SECRET, không phải phiên đăng nhập — Railway Cron Service
 * gọi vào đây thì làm gì có cookie nào. Cùng lý do với webhook ngân hàng, và
 * middleware cho cả hai đi qua ở cùng một chỗ.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Tên đường dẫn tiếng Việt, không phải tên hàm SQL. Hai lý do: lịch cron đọc
 * được mà không cần mở repo, và đổi tên hàm SQL không làm chết một lịch đã đặt
 * trên Railway mà không ai nhớ ra để sửa.
 */
const VIEC = {
  'thu-hoi-thanh-vien': 'expire_memberships',
  'leo-thang-ticket': 'escalate_overdue_tickets',
  'nhac-no': 'remind_unpaid_invoices',
  'mo-ky-bao-tri': 'mo_ky_bao_tri',
  'don-ma-dang-nhap': 'auth_don_ma',
  // Hạn lưu 90 ngày của sổ ra vào (§17). Quên đặt lịch này thì sổ giữ mãi —
  // tức là đúng cái mà tính năng khách thăm hứa với cư dân là sẽ không làm.
  'don-so-ra-vao': 'xoa_khach_cu',
} as const

type Viec = keyof typeof VIEC

export async function POST(
  request: NextRequest, ctx: { params: Promise<{ viec: string }> },
) {
  const bimat = process.env.CRON_SECRET
  // CHƯA CẤU HÌNH THÌ TỪ CHỐI, không phải cho qua. Mở sẵn một endpoint chạy
  // được job nền chỉ vì quên điền biến môi trường thì ai cũng bắn được lệnh
  // nhắc nợ — tức là spam thông báo tới toàn bộ cư dân.
  if (!bimat) {
    return NextResponse.json({ loi: 'Chưa cấu hình CRON_SECRET.' }, { status: 503 })
  }
  if (!bangNhau(request.headers.get('x-cron-key') ?? '', bimat)) {
    return NextResponse.json({ loi: 'Sai khóa.' }, { status: 401 })
  }

  const ten = (await ctx.params).viec
  if (!(ten in VIEC)) {
    return NextResponse.json(
      { loi: `Không có việc "${ten}".`, co: Object.keys(VIEC) }, { status: 404 })
  }

  const batDau = Date.now()
  const db = await createAdminClient()
  const { data, error } = await db.rpc(VIEC[ten as Viec])
  if (error) {
    // Trả 500 chứ không phải 200-kèm-lỗi: Railway đánh dấu lần chạy là thất bại
    // và log giữ lại. Trả 200 thì lịch cứ xanh trong khi việc thì không chạy.
    console.error(`cron ${ten} that bai:`, error)
    return NextResponse.json({ viec: ten, loi: error.message }, { status: 500 })
  }
  // `so` là số dòng hàm đó đụng tới. Một lịch cron không nói ra con số nào thì
  // "đã chạy" và "chạy mà không làm gì" nhìn giống hệt nhau trong log.
  return NextResponse.json({ viec: ten, so: data ?? null, ms: Date.now() - batDau })
}
