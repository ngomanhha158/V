import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/db/admin'
import { bangNhau } from '@/lib/bi-mat'
import { dayThongBao } from '@/lib/push'
import { JOB, type TenJob } from '@/lib/job-nen'
import type { Client } from '@/lib/db/postgrest'

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
 *
 * Danh sách job và lịch nằm ở lib/job-nen.ts, không nằm ở đây: cùng một danh
 * sách đó còn phải trả lời cho màn go-live câu "job nào chưa từng chạy", và
 * hai bản chép tay thì sớm muộn cũng lệch.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Job phải chạy TRONG NODE, không phải một hàm SQL.
 *
 * Web Push đòi mã hoá ECDH + AES-GCM và ký VAPID; Postgres không làm được, nên
 * job này mang `ham: null` trong danh mục và được nối vào đây. Vẫn chung route
 * và chung CRON_SECRET: tách ra một endpoint riêng là thêm một khoá nữa để
 * quên, và thêm một chỗ nữa mà bảng đối chiếu lịch cron không nhìn tới.
 */
const VIEC_NODE: Record<string, () => Promise<unknown>> = {
  'day-thong-bao': dayThongBao,
}

/**
 * Con số trả về cho lần chạy này.
 *
 * Hàm SQL trả thẳng một số dòng. Job Node trả một bảng phân tích, mà con số
 * trả lời được câu "nó có làm gì không" là số thông báo ĐẨY ĐI ĐƯỢC — không
 * phải số máy đã gỡ hay số lỗi lặt vặt.
 */
function soDong(kq: unknown): number | null {
  if (typeof kq === 'number') return kq
  if (kq && typeof kq === 'object' && 'gui' in kq && typeof kq.gui === 'number') {
    return kq.gui
  }
  return null
}

/**
 * Ghi lại lần chạy này để màn go-live thấy được.
 *
 * KHÔNG ném lỗi ra ngoài: ghi sổ hỏng không được phép làm một job chạy đúng bị
 * đánh là đỏ. Nhưng phải kêu trong log — bảng trống mà mọi job vẫn xanh là một
 * kiểu hỏng lặng lẽ mới, đúng thứ bảng này sinh ra để dẹp.
 */
async function ghiNhan(
  db: Client, viec: string, ok: boolean,
  so: number | null, ms: number, loi: string | null,
) {
  const { error } = await db.rpc('job_ghi_nhan', {
    p_viec: viec, p_ok: ok, p_so: so, p_ms: ms, p_loi: loi,
  })
  if (error) console.error(`khong ghi duoc lan chay ${viec}:`, error.message)
}

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
  if (!(ten in JOB)) {
    return NextResponse.json(
      { loi: `Không có việc "${ten}".`, co: Object.keys(JOB) }, { status: 404 })
  }
  const job = JOB[ten as TenJob]
  const batDau = Date.now()

  // Dựng client TRƯỚC khi chạy: thiếu AUTH_JWT_SECRET thì cả nhánh SQL lẫn
  // nhánh Node đều hỏng ở bước này, và lúc đó cũng không ghi sổ được — nên trả
  // 500 ngay thay vì chạy nửa vời rồi im.
  let db: Client
  try {
    db = await createAdminClient()
  } catch (e) {
    console.error(`cron ${ten} khong ket noi duoc:`, e)
    return NextResponse.json({ viec: ten, loi: (e as Error).message }, { status: 500 })
  }

  try {
    let kq: unknown
    if (job.ham === null) {
      kq = await VIEC_NODE[ten]()
    } else {
      const { data, error } = await db.rpc(job.ham)
      if (error) throw new Error(error.message)
      kq = data
    }
    // `so` là số dòng hàm đó đụng tới. Một lịch cron không nói ra con số nào thì
    // "đã chạy" và "chạy mà không làm gì" nhìn giống hệt nhau trong log.
    const so = soDong(kq)
    const ms = Date.now() - batDau
    await ghiNhan(db, ten, true, so, ms, null)
    return NextResponse.json({ viec: ten, so, ms })
  } catch (e) {
    // Trả 500 chứ không phải 200-kèm-lỗi: Railway đánh dấu lần chạy là thất bại
    // và log giữ lại. Trả 200 thì lịch cứ xanh trong khi việc thì không chạy.
    // Chưa cấu hình khoá VAPID cũng rơi vào đây, và nó PHẢI làm lịch cron đỏ.
    const loi = (e as Error).message
    console.error(`cron ${ten} that bai:`, e)
    await ghiNhan(db, ten, false, null, Date.now() - batDau, loi)
    return NextResponse.json({ viec: ten, loi }, { status: 500 })
  }
}
