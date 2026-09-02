import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/db/admin'
import { docWebhook, laNhaCungCap, type NhaCungCap } from '@/lib/bank/adapter'
import { demLuot, ipClient, xoaLuot } from '@/lib/rate-limit'

// Chỉ đếm lượt SAI. Nhà cung cấp gửi đúng khóa thì bắn bao nhiêu cũng được —
// ngày cuối tháng cả trăm giao dịch về một lúc là chuyện bình thường, chặn
// nhầm ở đó là mất tiền. Còn dò khóa thì mỗi lần dò là một lần sai.
const SO_LAN_SAI = 10
const CUA_SO_MS = 10 * 60_000

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

  const khoaDem = `wh:${nha_cung_cap}:${ipClient(req)}`
  const loiKhoa = kiemTraBiMat(nha_cung_cap, req)
  if (loiKhoa) {
    const { chan, choMs } = demLuot(khoaDem, SO_LAN_SAI, CUA_SO_MS)
    if (chan) {
      return NextResponse.json(
        { success: false, message: 'Qua nhieu lan sai khoa' },
        { status: 429, headers: { 'retry-after': String(Math.ceil(choMs / 1000)) } },
      )
    }
    return NextResponse.json({ success: false, message: loiKhoa }, { status: 401 })
  }
  // Khóa đúng -> xóa bộ đếm. Nhà cung cấp đổi khóa giữa chừng (xoay khóa định
  // kỳ) không bị treo 10 phút vì mấy lượt sai trước đó.
  xoaLuot(khoaDem)

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

  const supabase = await createAdminClient()
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
      // Ghi log để còn dò được, nhưng CHỈ mã lỗi + provider_ref. Không ghi
      // error.details: chỗ đó chứa nguyên giá trị của dòng dữ liệu, mà dòng
      // này có nội dung chuyển khoản kèm tên người gửi.
      console.error('[webhook] ghi_nhan_tien_ve loi', {
        nhaCungCap: nha_cung_cap, providerRef: g.providerRef, code: error.code,
        message: error.message,
      })
      // Trả về thông điệp CHUNG. Dội nguyên lỗi Postgres về phía nhà cung cấp
      // là biếu không tên bảng, tên ràng buộc và đôi khi cả dữ liệu dòng.
      //
      // 500 để nhà cung cấp bắn lại: lỗi ở đây thường là DB tạm không với tới
      // được, mà bỏ qua một giao dịch tiền là mất tiền của cư dân. Bắn lại an
      // toàn vì khóa (provider, provider_ref) chặn ghi trùng.
      return NextResponse.json(
        { success: false, message: 'Loi noi bo, vui long gui lai', da_xu_ly: ketQua.length },
        { status: 500 },
      )
    }
    ketQua.push(data)
  }

  return NextResponse.json({ success: true, da_nhan: ds.length, ket_qua: ketQua })
}
