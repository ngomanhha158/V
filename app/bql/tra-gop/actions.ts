'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type TraGopState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') {
    return 'Chỉ trưởng ban quản lý hoặc thành viên ban quản trị mới làm được việc này.'
  }
  if (code === '42883' || code === '42P01') {
    return 'Phần thu theo đợt chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

function lamMoi(id?: string) {
  revalidatePath('/bql/tra-gop')
  revalidatePath('/tra-gop')
  if (id) revalidatePath(`/bql/tra-gop/${id}`)
}

export async function lapKeHoach(_prev: TraGopState, formData: FormData): Promise<TraGopState> {
  const project = String(formData.get('project') ?? '')
  const ten = String(formData.get('ten') ?? '').trim()
  const tong = Number(String(formData.get('tong') ?? '').replace(/[^\d]/g, ''))
  const cachChia = String(formData.get('cach_chia') ?? '')
  const soDot = Number(formData.get('so_dot'))
  const ky = String(formData.get('ky') ?? '')
  const nghiQuyet = String(formData.get('nghi_quyet') ?? '').trim()

  if (!project) return { error: 'Chưa có dự án.' }
  if (ten.length < 3) return { error: 'Đặt tên khoản thu — dòng này in nguyên văn lên hóa đơn của từng nhà.' }
  if (!Number.isFinite(tong) || tong <= 0) return { error: 'Chưa nhập tổng chi phí.' }
  if (!['theo_can', 'theo_m2'].includes(cachChia)) return { error: 'Chưa chọn cách chia.' }
  if (!Number.isInteger(soDot) || soDot < 1 || soDot > 36) {
    return { error: 'Số đợt phải từ 1 đến 36. Dài hơn ba năm thì đó không còn là chia đợt.' }
  }
  if (!/^\d{4}-\d{2}$/.test(ky)) return { error: 'Chưa chọn kỳ bắt đầu.' }
  if (!nghiQuyet) {
    return {
      error:
        'Phải ghi số nghị quyết. Khoản lớn phân bổ cho cả tòa mà không có nghị quyết '
        + 'thì đó là một khoản thu do một người quyết định.',
    }
  }

  const db = await createClient()
  const ngayNq = String(formData.get('ngay_nq') ?? '').trim()
  const { data, error } = await db.rpc('lap_ke_hoach_thu', {
    p_project: project,
    p_ten: ten,
    p_tong: tong,
    p_cach_chia: cachChia,
    p_so_dot: soDot,
    p_ky_bat_dau: `${ky}-01`,
    p_nghi_quyet: nghiQuyet,
    p_ngay_nq: /^\d{4}-\d{2}-\d{2}$/.test(ngayNq) ? ngayNq : null,
    p_mo_ta: String(formData.get('mo_ta') ?? '').trim() || null,
  })
  if (error) {
    // 22023 và 23514 là câu hệ thống tự viết, và chúng đã nói đúng việc phải làm
    // ("nhập đủ diện tích", "chọn kỳ bắt đầu muộn hơn"). Dịch lại là làm mờ một
    // hướng dẫn vốn cụ thể hơn bất cứ câu chung chung nào.
    if (error.code === '22023' || error.code === '23514') return { error: error.message }
    return { error: dichLoi(error.code, `Không lập được: ${error.message}`) }
  }

  lamMoi(String(data ?? ''))
  return {
    ok:
      'Đã lập. Số tiền của từng căn đã đóng băng — sửa diện tích trong hồ sơ căn hộ '
      + 'từ giờ không làm đổi con số nào. Đợt 1 sẽ tự vào hóa đơn khi bạn sinh hóa đơn kỳ đó.',
  }
}

export async function huyKeHoach(_prev: TraGopState, formData: FormData): Promise<TraGopState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu kế hoạch thu.' }
  if (lyDo.length < 5) return { error: 'Ghi lý do dừng — kế hoạch vẫn nằm lại trong sổ kèm dòng này.' }

  const db = await createClient()
  const { data, error } = await db.rpc('huy_ke_hoach_thu', { p_id: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23505') return { error: 'Kế hoạch này đã dừng rồi.' }
    return { error: dichLoi(error.code, `Không dừng được: ${error.message}`) }
  }

  lamMoi(id)
  const kq = (data ?? {}) as { da_len_hoa_don?: number; dung_thu?: number }
  const da = Number(kq.da_len_hoa_don ?? 0)
  const con = Number(kq.dung_thu ?? 0)
  return {
    ok:
      `Đã dừng thu ${con.toLocaleString('vi-VN')}đ chưa lên hóa đơn phát hành. `
      + `${da.toLocaleString('vi-VN')}đ đã nằm trên hóa đơn đã phát hành thì GIỮ NGUYÊN — `
      + 'gỡ nó là làm tờ hóa đơn cư dân đang cầm nói khác sổ.',
  }
}
