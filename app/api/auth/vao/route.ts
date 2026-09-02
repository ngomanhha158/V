import { type NextRequest, NextResponse } from 'next/server'
import { normalizeEmail, toE164VN } from '@/lib/phone'
import { moPhien, vaoBangMa, vaoBangMatKhau } from '@/lib/db/dang-nhap'

/** Đổi mã một lần hoặc mật khẩu lấy phiên đăng nhập. */
export async function POST(request: NextRequest) {
  let than: { danhTinh?: unknown; ma?: unknown; matKhau?: unknown }
  try {
    than = await request.json()
  } catch {
    return NextResponse.json({ tt: 'la' }, { status: 400 })
  }

  const tho = String(than.danhTinh ?? '').trim()
  const danhTinh = tho.includes('@') ? normalizeEmail(tho) : toE164VN(tho)
  if (!danhTinh) return NextResponse.json({ tt: 'la' })

  const ma = String(than.ma ?? '').trim()
  const matKhau = String(than.matKhau ?? '')
  if (!ma && !matKhau) return NextResponse.json({ tt: 'la' })

  const kq = matKhau
    ? await vaoBangMatKhau(danhTinh, matKhau)
    : await vaoBangMa(danhTinh, ma)

  if (!kq.ok) return NextResponse.json({ tt: kq.tt, giay: kq.giay })

  await moPhien(kq.uid)
  return NextResponse.json({ tt: 'ok' })
}
