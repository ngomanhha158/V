import { type NextRequest, NextResponse } from 'next/server'
import { goYNguoiSua, loiDangNhap } from '@/lib/auth-loi'
import { normalizeEmail, toE164VN } from '@/lib/phone'
import { moPhien, vaoBangMa, vaoBangMatKhau } from '@/lib/db/dang-nhap'

/**
 * Trả về CẢ CÂU CHỮ, không chỉ mã trạng thái.
 *
 * Trước đây chỉ gửi mã, còn câu chữ tra ở trình duyệt. Nghĩa là mỗi lần thêm
 * một trạng thái ở máy chủ, mọi tab đang mở của người dùng vẫn giữ bản JS cũ
 * và tra không ra — họ nhận "có lỗi không rõ, thử lại giúp em", trong khi máy
 * chủ đã biết chính xác chuyện gì. Đã xảy ra thật ngay lần deploy đầu.
 *
 * Câu chữ tính ở đây thì bản cũ hay mới cũng hiện đúng thứ máy chủ muốn nói.
 */
function traLoi(tt: string, giay?: number, maLoi?: string) {
  return NextResponse.json({
    tt, giay, maLoi, cau: loiDangNhap(tt, giay ?? 0), goY: goYNguoiSua(tt),
  })
}

/** Đổi mã một lần hoặc mật khẩu lấy phiên đăng nhập. */
export async function POST(request: NextRequest) {
  let than: { danhTinh?: unknown; ma?: unknown; matKhau?: unknown }
  try {
    than = await request.json()
  } catch {
    return NextResponse.json({ tt: 'la', cau: loiDangNhap('la') }, { status: 400 })
  }

  const tho = String(than.danhTinh ?? '').trim()
  const danhTinh = tho.includes('@') ? normalizeEmail(tho) : toE164VN(tho)
  if (!danhTinh) return traLoi('la')

  const ma = String(than.ma ?? '').trim()
  const matKhau = String(than.matKhau ?? '')
  if (!ma && !matKhau) return traLoi('la')

  const kq = matKhau
    ? await vaoBangMatKhau(danhTinh, matKhau)
    : await vaoBangMa(danhTinh, ma)

  if (!kq.ok) return traLoi(kq.tt, kq.giay, kq.maLoi)

  await moPhien(kq.uid)
  return NextResponse.json({ tt: 'ok' })
}
