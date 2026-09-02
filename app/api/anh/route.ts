import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'
import { ANH_TOI_DA, duongMoi, KIEU_CHO_PHEP, thuMuc } from '@/lib/anh'

/**
 * Nhận ảnh hỏng hóc. Thay `supabase.storage.upload()`.
 *
 * Trước đây trình duyệt tải thẳng lên Supabase Storage và RLS của Storage là
 * chốt chặn. Giờ không còn tầng đó, nên MỌI chốt đều nằm ở đây — và ba cái
 * dưới đây phải chạy theo đúng thứ tự này: có phiên, có quyền với căn, rồi mới
 * tới kiểu file và kích thước. Kiểm file trước là để người lạ dò được căn nào
 * tồn tại bằng cách xem lỗi nào trả về.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ loi: 'Chưa đăng nhập.' }, { status: 401 })

  const fd = await request.formData().catch(() => null)
  const unit = String(fd?.get('unit') ?? '')
  const file = fd?.get('anh')
  if (!unit || !(file instanceof File)) {
    return NextResponse.json({ loi: 'Thiếu ảnh hoặc thiếu căn hộ.' }, { status: 400 })
  }

  // current_unit_ids() là ĐÚNG hàm mà RLS của tickets dùng: nó đã tính cả
  // valid_from/valid_to và status. Tự viết lại điều kiện ở đây là mở ra khả
  // năng hai chỗ lệch nhau, và lệch nghĩa là người đã hết hợp đồng thuê vẫn
  // gắn được ảnh vào căn cũ.
  const { data: cuaToi } = await supabase.rpc('current_unit_ids')
  if (!(cuaToi ?? []).includes(unit)) {
    return NextResponse.json({ loi: 'Căn hộ này không phải của bạn.' }, { status: 403 })
  }

  if (!(KIEU_CHO_PHEP as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { loi: 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.' }, { status: 415 })
  }
  if (file.size > ANH_TOI_DA) {
    return NextResponse.json(
      { loi: `Ảnh nặng ${(file.size / 1048576).toFixed(1)}MB, tối đa 5MB.` }, { status: 413 })
  }

  const duong = duongMoi(unit, file.type)
  const dich = join(thuMuc(), duong)
  try {
    await mkdir(dirname(dich), { recursive: true })
    await writeFile(dich, Buffer.from(await file.arrayBuffer()))
  } catch (e) {
    // Gần như luôn là ANH_DIR chưa gắn volume hoặc không ghi được. Ghi ra log
    // với đường dẫn thật, vì triệu chứng ở màn cư dân chỉ là "không tải được".
    console.error('khong ghi duoc anh vao', dich, e)
    return NextResponse.json(
      { loi: 'Máy chủ chưa lưu được ảnh. Báo ban quản lý.' }, { status: 500 })
  }
  return NextResponse.json({ duong })
}
