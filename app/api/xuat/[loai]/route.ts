import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { baoCao, docKy, tenTep } from '@/lib/xuat/bao-cao'
import { dungWorkbook } from '@/lib/xuat/excel'
import { layDong } from '@/lib/xuat/lay-du-lieu'

export const dynamic = 'force-dynamic'

/**
 * Xuất một báo cáo ra .xlsx.
 *
 * Là route handler chứ không phải server action: server action trả về dữ liệu
 * cho React, còn đây cần trả về nguyên file kèm Content-Disposition để trình
 * duyệt bật hộp thoại lưu.
 *
 * Middleware đã chặn người chưa đăng nhập trước khi tới đây. Chốt còn lại là
 * `is_staff` bên dưới, cộng với RLS trên từng bảng — cư dân gọi thẳng URL này
 * vẫn không lấy được gì.
 */
export async function GET(
  req: NextRequest, { params }: { params: Promise<{ loai: string }> },
) {
  const { loai } = await params
  const bc = baoCao(loai)
  if (!bc) return loi(404, `Không có báo cáo "${loai}".`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return loi(401, 'Chưa đăng nhập.')

  const { data: project } = await supabase
    .from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return loi(404, 'Chưa có dự án nào trong hệ thống.')

  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) return loi(403, 'Chỉ ban quản lý mới xuất được báo cáo.')

  const ky = bc.theoKy ? docKy(req.nextUrl.searchParams.get('ky')) : null
  if (bc.theoKy && !ky) return loi(400, 'Kỳ không hợp lệ. Cần dạng YYYY-MM, ví dụ 2026-09.')

  const kq = await layDong(supabase, bc.id, project.id, ky)
  if ('loi' in kq) return loi(400, kq.loi)

  // Chốt một lần rồi dùng cho cả nội dung file lẫn tên file: hai chỗ lệch nhau
  // vài giây là đủ để người ta nghi ngờ chính con số trong file.
  const chotLuc = new Date()
  const buf = await dungWorkbook(bc, kq.dong, {
    duAn: project.name,
    ky,
    chotLuc,
    nguoiXuat: user.email ?? user.phone ?? user.id,
  })

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${tenTep(bc, ky, chotLuc)}"`,
      // Báo cáo tài chính không được nằm lại trong cache của trình duyệt hay
      // của bất kỳ proxy nào trên đường đi.
      'cache-control': 'no-store, private',
    },
  })
}

const loi = (ma: number, chu: string) =>
  NextResponse.json({ loi: chu }, { status: ma, headers: { 'cache-control': 'no-store' } })
