import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { docWebhook, laNhaCungCap, type NhaCungCap } from '@/lib/bank/adapter'

// node runtime: cần timingSafeEqual. force-dynamic: đây là webhook, không cache.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * So sánh bí mật theo kiểu hằng thời gian. So bằng `===` để lộ độ dài và vị trí
 * byte đầu tiên khác nhau qua thời gian trả lời — đủ để dò ra khóa từng byte
 * một nếu người ta chịu khó bắn vài triệu lần.
 */
function bangNhau(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  // timingSafeEqual ném lỗi khi khác độ dài, mà bản thân việc ném lỗi cũng là
  // rò rỉ. Đệm về cùng độ dài rồi mới so, và kiểm tra độ dài như một điều kiện.
  const n = Math.max(x.length, y.length, 1)
  const px = Buffer.alloc(n)
  const py = Buffer.alloc(n)
  x.copy(px); y.copy(py)
  return timingSafeEqual(px, py) && x.length === y.length
}

/** Bí mật của từng nhà cung cấp + cách nó gửi lên. */
function kiemTraBiMat(nhaCungCap: NhaCungCap, req: Request): string | null {
  if (nhaCungCap === 'sepay') {
    const bimat = process.env.SEPAY_WEBHOOK_APIKEY
    // CHƯA CẤU HÌNH THÌ TỪ CHỐI, không phải cho qua. Mở sẵn một endpoint ghi
    // tiền vào hệ thống chỉ vì quên điền biến môi trường là hỏng kiểu tệ nhất:
    // không ai thấy gì cho tới lúc sổ sách lệch.
    if (!bimat) return 'Chua cau hinh SEPAY_WEBHOOK_APIKEY'
    const h = req.headers.get('authorization') ?? ''
    return bangNhau(h, `Apikey ${bimat}`) ? null : 'Sai khoa'
  }
  const bimat = process.env.CASSO_WEBHOOK_TOKEN
  if (!bimat) return 'Chua cau hinh CASSO_WEBHOOK_TOKEN'
  return bangNhau(req.headers.get('secure-token') ?? '', bimat) ? null : 'Sai khoa'
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ nha_cung_cap: string }> },
) {
  const { nha_cung_cap } = await params
  if (!laNhaCungCap(nha_cung_cap)) {
    return NextResponse.json({ success: false, message: 'Nha cung cap la' }, { status: 404 })
  }

  const loiKhoa = kiemTraBiMat(nha_cung_cap, req)
  if (loiKhoa) {
    return NextResponse.json({ success: false, message: loiKhoa }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Body khong phai JSON' }, { status: 400 })
  }

  let ds
  try {
    ds = docWebhook(nha_cung_cap, body)
  } catch (e) {
    // 400 chứ không phải 500: gói tin sai dạng thì bắn lại bao nhiêu lần cũng
    // vẫn sai. Trả 5xx là mời nhà cung cấp retry vô hạn một thứ không bao giờ
    // chạy được.
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Khong doc duoc goi tin' },
      { status: 400 },
    )
  }
  if (ds.length === 0) {
    // Không có giao dịch tiền vào nào (toàn tiền ra chẳng hạn) — vẫn là 200,
    // nếu không nhà cung cấp sẽ bắn lại mãi.
    return NextResponse.json({ success: true, da_nhan: 0 })
  }

  const supabase = createAdminClient()
  const { data: project } = await supabase.from('projects').select('id').limit(1).maybeSingle()
  if (!project) {
    return NextResponse.json({ success: false, message: 'Chua co du an' }, { status: 500 })
  }

  const ketQua = []
  for (const g of ds) {
    const { data, error } = await supabase.rpc('ghi_nhan_tien_ve', {
      p_project: project.id,
      p_provider: nha_cung_cap,
      p_provider_ref: g.providerRef,
      p_amount: g.amount,
      p_content: g.content,
      p_paid_at: g.paidAt,
      p_bank_ref: g.bankRef,
      p_account: g.accountNumber,
      p_raw: g.raw as never,
    })
    if (error) {
      // 500 để nhà cung cấp bắn lại: lỗi ở đây thường là DB tạm không với tới
      // được, mà bỏ qua một giao dịch tiền là mất tiền của cư dân. Bắn lại an
      // toàn vì khóa (provider, provider_ref) chặn ghi trùng.
      return NextResponse.json(
        { success: false, message: error.message, da_xu_ly: ketQua.length },
        { status: 500 },
      )
    }
    ketQua.push(data)
  }

  return NextResponse.json({ success: true, da_nhan: ds.length, ket_qua: ketQua })
}
