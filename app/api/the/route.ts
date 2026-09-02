import QRCode from 'qrcode'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
import { biMatJwt } from '@/lib/db/env'
import { kyThe, THE_SONG_GIAY } from '@/lib/the'

/**
 * Cấp một mã thẻ mới cho căn hộ của chính người đang đăng nhập.
 *
 * Trả về ẢNH mã QR chứ không trả chuỗi mã, cố ý: vẽ QR ở máy chủ thì thư viện
 * qrcode không phải đi vào bundle của trình duyệt. Cư dân mở app bằng 3G ở hầm
 * gửi xe — đó là chỗ tính năng này được dùng nhiều nhất, và cũng là chỗ mỗi
 * chục KB đều đếm được.
 *
 * Ảnh là SVG data URL: nó co giãn theo màn hình mà không vỡ, và nhỏ hơn PNG.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ loi: 'Chưa đăng nhập.' }, { status: 401 })

  const unit = request.nextUrl.searchParams.get('unit') ?? ''
  if (!unit) return NextResponse.json({ loi: 'Thiếu căn hộ.' }, { status: 400 })

  // current_unit_ids() là ĐÚNG hàm mà RLS dùng: nó đã tính cả valid_from,
  // valid_to và status. Tự viết lại điều kiện ở đây là mở ra khả năng hai chỗ
  // lệch nhau, và lệch nghĩa là người đã trả nhà vẫn xin được thẻ mới.
  const { data: cuaToi, error } = await db.rpc('current_unit_ids')
  if (error) return NextResponse.json({ loi: 'Không đọc được căn hộ của bạn.' }, { status: 500 })
  if (!(cuaToi ?? []).includes(unit)) {
    return NextResponse.json({ loi: 'Căn hộ này không phải của bạn.' }, { status: 403 })
  }

  const bay = Date.now()
  const ma = kyThe(user.id, unit, biMatJwt(), THE_SONG_GIAY, bay)
  const qr = await QRCode.toString(`${request.nextUrl.origin}/quet/${ma}`, {
    type: 'svg', margin: 0, errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  })

  return NextResponse.json(
    {
      anh: `data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}`,
      hetHan: Math.floor(bay / 1000) + THE_SONG_GIAY,
    },
    // no-store là bắt buộc: một mã thẻ nằm lại trong cache của trình duyệt hay
    // của proxy là một mã dùng được sau khi người ta đã trả nhà.
    { headers: { 'cache-control': 'no-store, private' } },
  )
}
