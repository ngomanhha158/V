'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { HANG_MUC } from '@/lib/bao-tri'

export type BaoTriState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Bạn không có quyền sửa lịch bảo trì của khu này.'
  if (code === '22023') return 'Lần bảo trì này đã được đóng rồi. Tải lại trang để thấy trạng thái mới.'
  if (code === 'P0002') return 'Không tìm thấy lần bảo trì này — có thể ai đó vừa xóa kế hoạch.'
  if (code === '42P01') {
    return 'Bảng lịch bảo trì chưa có trên database. Chạy lại schema.sql rồi thử lại.'
  }
  return msg
}

async function duAn() {
  const db = await createClient()
  const { data } = await db.from('projects').select('id').limit(1).maybeSingle()
  return { db, project: data?.id ?? null }
}

/** Đọc số nguyên trong khoảng, trả null nếu không đọc được. */
function soNguyen(raw: string, tu: number, den: number): number | null {
  const n = Number(raw.trim())
  return Number.isInteger(n) && n >= tu && n <= den ? n : null
}

function doc(formData: FormData) {
  const ten = String(formData.get('ten') ?? '').trim()
  const hangMuc = String(formData.get('hang_muc') ?? '')
  const chuKy = soNguyen(String(formData.get('chu_ky_ngay') ?? ''), 1, 3650)
  const nhac = soNguyen(String(formData.get('nhac_truoc_ngay') ?? '7'), 0, 180)
  const han = String(formData.get('han_ke_tiep') ?? '').trim()
  const toa = String(formData.get('building_id') ?? '')
  const nhaThau = String(formData.get('nha_thau') ?? '').trim()

  if (!ten) return { loi: 'Chưa đặt tên cho hạng mục bảo trì.' }
  if (!(hangMuc in HANG_MUC)) return { loi: 'Hạng mục không hợp lệ.' }
  if (chuKy === null) return { loi: 'Chu kỳ phải là số ngày từ 1 tới 3650.' }
  if (nhac === null) return { loi: 'Số ngày nhắc trước phải từ 0 tới 180.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(han)) return { loi: 'Hạn kế tiếp phải là một ngày hợp lệ.' }
  // Nhắc trước dài hơn cả chu kỳ nghĩa là lần bảo trì sau mở ra trước khi lần
  // trước kịp đóng — hai lần cùng mở, và không ai biết đang làm cái nào.
  if (nhac >= chuKy) {
    return { loi: `Nhắc trước ${nhac} ngày mà chu kỳ chỉ ${chuKy} ngày: lần sau sẽ mở ra trước khi lần này kịp đóng.` }
  }

  return {
    cot: {
      ten, hang_muc: hangMuc, chu_ky_ngay: chuKy, nhac_truoc_ngay: nhac,
      han_ke_tiep: han,
      building_id: toa || null,
      nha_thau: nhaThau || null,
      bat_buoc_phap_ly: formData.get('bat_buoc') === '1',
    },
  }
}

export async function themKeHoach(_prev: BaoTriState, formData: FormData): Promise<BaoTriState> {
  const { db, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }
  const v = doc(formData)
  if ('loi' in v) return { error: v.loi }

  const { error } = await db.from('maintenance_plans')
    .insert({ ...v.cot, project_id: project })
  if (error) return { error: dichLoi(error.code, `Không thêm được: ${error.message}`) }

  revalidatePath('/bql/bao-tri')
  return { ok: `Đã thêm "${v.cot.ten}". Hệ thống sẽ mở việc khi còn ${v.cot.nhac_truoc_ngay} ngày.` }
}

export async function suaKeHoach(_prev: BaoTriState, formData: FormData): Promise<BaoTriState> {
  const { db, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Thiếu kế hoạch cần sửa.' }
  const v = doc(formData)
  if ('loi' in v) return { error: v.loi }

  const { error } = await db.from('maintenance_plans')
    .update(v.cot).eq('id', id).eq('project_id', project)
  if (error) return { error: dichLoi(error.code, `Không sửa được: ${error.message}`) }

  revalidatePath('/bql/bao-tri')
  return { ok: `Đã cập nhật "${v.cot.ten}".` }
}

/** Bật/tắt chứ không xóa: xóa kế hoạch là mất luôn lịch sử các lần đã làm. */
export async function doiTrangThai(_prev: BaoTriState, formData: FormData): Promise<BaoTriState> {
  const { db, project } = await duAn()
  if (!project) return { error: 'Chưa có dự án nào trong hệ thống.' }
  const id = String(formData.get('id') ?? '')
  const bat = formData.get('bat') === '1'
  const ten = String(formData.get('ten') ?? '')
  if (!id) return { error: 'Thiếu kế hoạch.' }

  const { error } = await db.from('maintenance_plans')
    .update({ is_active: bat }).eq('id', id).eq('project_id', project)
  if (error) return { error: dichLoi(error.code, `Không đổi được: ${error.message}`) }

  revalidatePath('/bql/bao-tri')
  return {
    ok: bat
      ? `Đã bật lại "${ten}".`
      : `Đã tạm dừng "${ten}". Lịch sử các lần đã làm vẫn giữ nguyên.`,
  }
}

export async function xongLan(_prev: BaoTriState, formData: FormData): Promise<BaoTriState> {
  const db = await createClient()
  const id = String(formData.get('id') ?? '')
  const ten = String(formData.get('ten') ?? '')
  const ketQua = String(formData.get('ket_qua') ?? '').trim()
  if (!id) return { error: 'Thiếu lần bảo trì.' }

  const { data, error } = await db.rpc('xong_bao_tri', {
    p_run: id, p_ket_qua: ketQua || undefined,
  })
  if (error) return { error: dichLoi(error.code, `Không đóng được: ${error.message}`) }

  const han = typeof data === 'string' ? data.slice(0, 10).split('-').reverse().join('/') : '—'
  revalidatePath('/bql/bao-tri')
  return {
    ok: `Đã đóng "${ten}". Hạn kế tiếp: ${han} — tính từ hôm nay cộng chu kỳ, `
      + 'vì giấy kiểm định có hiệu lực từ ngày kiểm chứ không từ ngày lẽ ra phải kiểm.',
  }
}
