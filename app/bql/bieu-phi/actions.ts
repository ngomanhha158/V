'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { LOAI_XE, type LoaiXe } from '@/lib/xe'

export type BieuPhiState = { error?: string; ok?: string }

/** Đúng ba giá trị mà generate_invoices biết xử lý. Thêm giá trị thứ tư ở đây
 *  mà quên sửa hàm sinh hóa đơn thì phí đó lặng lẽ không lên hóa đơn nào. */
const CACH_TINH = ['fixed', 'per_m2', 'metered', 'per_vehicle'] as const
type CachTinh = (typeof CACH_TINH)[number]
const laCachTinh = (v: string): v is CachTinh =>
  (CACH_TINH as readonly string[]).includes(v)

const docLoaiXe = (v: unknown): LoaiXe | null =>
  (LOAI_XE as readonly string[]).includes(String(v)) ? (String(v) as LoaiXe) : null

/** Tiền VND không có xu. Nhận cả "16.500" và "16500" vì người nhập quen gõ dấu chấm. */
function docTien(s: string): number | null {
  const so = s.replace(/[.\s,]/g, '')
  if (!/^\d+$/.test(so)) return null
  const n = Number(so)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

async function duAn() {
  const db = await createClient()
  const duAn = await duAnBQL()
  return { db, project: duAn?.id ?? null }
}

function dichLoi(code: string | undefined, msg: string): string {
  // 23505 = trùng khóa. unique(project_id, code) -> mã phí đã tồn tại.
  if (code === '23505') return 'Mã phí này đã có rồi. Dùng mã khác, hoặc sửa dòng đang có.'
  // 42501 = RLS chặn. Người không phải nhân sự của dự án.
  if (code === '42501') return 'Bạn không có quyền sửa biểu phí của dự án này.'
  return msg
}

export async function themBieuPhi(
  _prev: BieuPhiState, formData: FormData,
): Promise<BieuPhiState> {
  const { db, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()
  const cach = String(formData.get('calc_method') ?? '')
  const gia = docTien(String(formData.get('unit_price') ?? ''))

  if (!code) return { error: 'Chưa nhập mã phí.' }
  if (!name) return { error: 'Chưa nhập tên phí.' }
  if (!laCachTinh(cach)) return { error: 'Cách tính không hợp lệ.' }
  if (gia === null) return { error: 'Đơn giá phải là số nguyên dương, đơn vị đồng.' }
  const loai = docLoaiXe(formData.get('loai_xe'))
  // Bắt chọn loại xe, không để trống rồi ngầm hiểu là "tất cả": một khoản
  // "phí gửi ô tô" đếm luôn xe đạp thì mỗi hộ thừa vài trăm nghìn một tháng, và
  // chỉ lộ ra khi có người ngồi cộng lại hóa đơn.
  if (cach === 'per_vehicle' && !loai) {
    return { error: 'Phí theo đầu xe phải chọn loại xe được tính.' }
  }

  const { error } = await db.from('fee_types')
    .insert({
      project_id: project, code, name, calc_method: cach, unit_price: gia,
      loai_xe: cach === 'per_vehicle' ? loai : null,
    })
  if (error) return { error: dichLoi(error.code, `Không thêm được: ${error.message}`) }

  revalidatePath('/bql/bieu-phi')
  revalidatePath('/bql/billing')
  revalidatePath('/bql/go-live')
  return { ok: `Đã thêm biểu phí ${code} — ${name}.` }
}

export async function suaBieuPhi(
  _prev: BieuPhiState, formData: FormData,
): Promise<BieuPhiState> {
  const { db, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const cach = String(formData.get('calc_method') ?? '')
  const gia = docTien(String(formData.get('unit_price') ?? ''))
  if (!id) return { error: 'Thiếu biểu phí cần sửa.' }
  if (!name) return { error: 'Chưa nhập tên phí.' }
  if (!laCachTinh(cach)) return { error: 'Cách tính không hợp lệ.' }
  if (gia === null) return { error: 'Đơn giá phải là số nguyên dương, đơn vị đồng.' }

  // CỐ Ý không cho sửa `code`: mã phí đã nằm trong các dòng hóa đơn đã phát và
  // trong đối chiếu của kế toán. Đổi mã là mất dấu vết. Muốn đổi thì tạo mã mới.
  const loai = docLoaiXe(formData.get('loai_xe'))
  if (cach === 'per_vehicle' && !loai) {
    return { error: 'Phí theo đầu xe phải chọn loại xe được tính.' }
  }

  const { error } = await db.from('fee_types')
    .update({
      name, calc_method: cach, unit_price: gia,
      loai_xe: cach === 'per_vehicle' ? loai : null,
    })
    .eq('id', id).eq('project_id', project)
  if (error) return { error: dichLoi(error.code, `Không sửa được: ${error.message}`) }

  revalidatePath('/bql/bieu-phi')
  revalidatePath('/bql/billing')
  return { ok: `Đã cập nhật ${name}. Hóa đơn ĐÃ PHÁT giữ nguyên giá cũ; giá mới áp cho kỳ sinh sau.` }
}

export async function xoaBieuPhi(
  _prev: BieuPhiState, formData: FormData,
): Promise<BieuPhiState> {
  const { db, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }

  const id = String(formData.get('id') ?? '')
  const ten = String(formData.get('ten') ?? '')
  if (!id) return { error: 'Thiếu biểu phí cần xóa.' }

  const { error } = await db.from('fee_types')
    .delete().eq('id', id).eq('project_id', project)
  if (error) {
    // 23503 = còn dòng hóa đơn hoặc chỉ số công tơ trỏ vào phí này. Đây không
    // phải sự cố — đây là hệ thống đang giữ lại lịch sử tiền. Nói đúng như vậy.
    if (error.code === '23503') {
      return { error: 'Không xóa được vì phí này đã nằm trong hóa đơn hoặc chỉ số công tơ đã ghi. Xóa đi là mất dấu vết tiền đã thu. Muốn ngừng dùng thì đặt đơn giá về mức mới, hoặc thôi không đưa vào kỳ sau.' }
    }
    return { error: dichLoi(error.code, `Không xóa được: ${error.message}`) }
  }

  revalidatePath('/bql/bieu-phi')
  revalidatePath('/bql/billing')
  revalidatePath('/bql/go-live')
  return { ok: `Đã xóa ${ten || 'biểu phí'}.` }
}
