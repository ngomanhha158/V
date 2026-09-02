'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  DIEN_TICH_TOI_DA, dieuKien, docDienTich, docLoc, soM2, taLoc, type ThamSo,
} from '@/lib/can-ho'

export type CanHoState = { error?: string; ok?: string }

const LOI_SO =
  `Diện tích phải là số dương, tối đa hai chữ số thập phân và không quá `
  + `${DIEN_TICH_TOI_DA.toLocaleString('vi-VN')} m². Ví dụ: 78,5`

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Bạn không có quyền sửa căn hộ của khu này.'
  return msg
}

async function moiTruong() {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id').limit(1).maybeSingle()
  return { supabase, project: project?.id ?? null }
}

/**
 * Đặt (hoặc xóa) diện tích của đúng một căn.
 *
 * Để trống là xóa diện tích — cố ý, vì "chưa đo" là một trạng thái có thật và
 * khác hẳn với 0 m². Cột cho phép null nên không cần bịa số.
 */
export async function datDienTich(_prev: CanHoState, formData: FormData): Promise<CanHoState> {
  const id = String(formData.get('id') ?? '')
  const ma = String(formData.get('ma') ?? '')
  const raw = String(formData.get('dien_tich') ?? '').trim()
  if (!id) return { error: 'Thiếu căn cần sửa.' }

  const dt = raw ? docDienTich(raw) : null
  if (raw && dt === null) return { error: `Căn ${ma}: ${LOI_SO}` }

  const { supabase } = await moiTruong()
  const { error, count } = await supabase
    .from('units').update({ area_m2: dt }, { count: 'exact' }).eq('id', id)
  if (error) return { error: dichLoi(error.code, `Không lưu được: ${error.message}`) }
  // RLS chặn bằng cách lọc dòng ra khỏi lệnh UPDATE, không ném lỗi. Không đếm
  // thì màn báo "đã lưu" trong khi database không đổi gì — kiểu nói dối tệ nhất.
  if (!count) {
    return { error: `Không sửa được căn ${ma}: căn không còn tồn tại, hoặc không thuộc khu bạn quản lý.` }
  }

  revalidatePath('/bql/can-ho')
  revalidatePath('/bql/bieu-phi')
  return {
    ok: dt === null
      ? `Đã xóa diện tích của căn ${ma}.`
      : `Căn ${ma} nay là ${soM2(dt)} m².`,
  }
}

/**
 * Áp một diện tích cho toàn bộ căn đang lọt bộ lọc trên màn.
 *
 * 468 căn thì gõ tay từng ô là hai ngày công. Nhưng "sửa hàng loạt" cũng là
 * cách nhanh nhất để hỏng hàng loạt, nên có hai chốt: bộ lọc được dựng lại từ
 * chính tham số của trang đang xem (cùng một hàm `dieuKien`), và mặc định
 * KHÔNG ghi đè căn đã có diện tích — muốn đè thì phải tự tick.
 */
export async function apHangLoat(_prev: CanHoState, formData: FormData): Promise<CanHoState> {
  const raw = String(formData.get('dien_tich') ?? '').trim()
  const ghiDe = formData.get('ghi_de') === '1'
  const dt = docDienTich(raw)
  if (dt === null) return { error: LOI_SO }

  const { supabase, project } = await moiTruong()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }

  const { data: toaNha } = await supabase.from('buildings').select('id, code').eq('project_id', project)
  const theoMa = new Map((toaNha ?? []).map((b) => [b.code.toUpperCase(), b.id]))

  const sp: ThamSo = {
    toa: String(formData.get('toa') ?? ''),
    tang: String(formData.get('tang') ?? ''),
    ma: String(formData.get('ma') ?? ''),
    thieu: String(formData.get('thieu') ?? ''),
  }
  const loc = docLoc(sp, theoMa)

  let q = supabase.from('units').update({ area_m2: dt }, { count: 'exact' })
  for (const d of dieuKien(loc)) {
    if (d.kieu === 'trongDuAn') q = q.in('building_id', d.ids)
    else if (d.kieu === 'toa') q = q.eq('building_id', d.gt)
    else if (d.kieu === 'tang') q = q.eq('floor_no', d.gt)
    else if (d.kieu === 'ma') q = q.ilike('code', d.mau)
    else q = q.is('area_m2', null)
  }
  // Chốt thứ hai, độc lập với bộ lọc: chưa tick ghi đè thì chỉ đụng vào căn
  // đang trống diện tích. Đặt sau vòng lặp nên dù bộ lọc có gì cũng không mất.
  if (!ghiDe) q = q.is('area_m2', null)

  const { error, count } = await q
  if (error) return { error: dichLoi(error.code, `Không áp được: ${error.message}`) }

  revalidatePath('/bql/can-ho')
  revalidatePath('/bql/bieu-phi')

  const pham = taLoc(loc)
  if (!count) {
    return {
      ok: ghiDe
        ? `Không căn nào khớp bộ lọc (${pham}) nên chưa sửa gì.`
        : `Mọi căn khớp bộ lọc (${pham}) đều đã có diện tích rồi, nên chưa sửa gì. `
          + 'Muốn ghi đè thì tick ô ghi đè.',
    }
  }
  return {
    ok: `Đã đặt ${soM2(dt)} m² cho ${count} căn (${pham})`
      + (ghiDe ? ', ghi đè cả căn đã có diện tích.' : ', bỏ qua căn đã có diện tích.'),
  }
}
