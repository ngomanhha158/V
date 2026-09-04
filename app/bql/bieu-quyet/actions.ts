'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type BQState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') {
    return 'Chỉ trưởng ban quản lý hoặc thành viên ban quản trị mới làm được việc này.'
  }
  if (code === '42883' || code === '42P01') {
    return 'Phần biểu quyết chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

function lamMoi(id?: string) {
  revalidatePath('/bql/bieu-quyet')
  revalidatePath('/bieu-quyet')
  if (id) {
    revalidatePath(`/bql/bieu-quyet/${id}`)
    revalidatePath(`/bieu-quyet/${id}`)
  }
}

export async function moCuoc(_prev: BQState, formData: FormData): Promise<BQState> {
  const project = String(formData.get('project') ?? '')
  const tieuDe = String(formData.get('tieu_de') ?? '').trim()
  const duHop = Number(formData.get('nguong_du_hop'))
  const thongQua = Number(formData.get('nguong_thong_qua'))
  if (!project) return { error: 'Chưa có dự án.' }
  if (tieuDe.length < 5) {
    return { error: 'Viết rõ nội dung đưa ra biểu quyết — cư dân bỏ phiếu cho một câu hỏi không tên thì lá phiếu đó vô nghĩa.' }
  }
  for (const [n, v] of [['dự họp', duHop], ['thông qua', thongQua]] as const) {
    if (!Number.isFinite(v) || v <= 0 || v > 100) {
      return { error: `Ngưỡng ${n} phải nằm trong khoảng 0–100%.` }
    }
  }

  const db = await createClient()
  const { data, error } = await db.rpc('mo_bieu_quyet', {
    p_project: project,
    p_tieu_de: tieuDe,
    p_noi_dung: String(formData.get('noi_dung') ?? '').trim() || null,
    p_nguong_du_hop: duHop,
    p_nguong_thong_qua: thongQua,
  })
  if (error) {
    // 22023 là câu hệ thống tự viết ra và nó đã nói đúng việc phải làm ("nhập
    // đủ diện tích rồi mới mở được"). Dịch lại ở đây là làm mờ đi một hướng
    // dẫn vốn đã cụ thể hơn bất cứ câu chung chung nào.
    if (error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không mở được: ${error.message}`) }
  }

  lamMoi(String(data ?? ''))
  return {
    ok: 'Đã mở. Danh sách căn và diện tích vừa được đóng băng — từ giờ sửa diện tích '
      + 'trong hồ sơ căn hộ cũng không làm đổi mẫu số của cuộc này.',
  }
}

export async function dongCuoc(_prev: BQState, formData: FormData): Promise<BQState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Thiếu cuộc biểu quyết.' }

  const db = await createClient()
  const { data, error } = await db.rpc('dong_bieu_quyet', { p_bq: id })
  if (error) {
    if (error.code === '23505') return { error: 'Cuộc này đã kiểm phiếu rồi.' }
    if (error.code === '23514') return { error: 'Cuộc này đã hủy, không kiểm phiếu được.' }
    return { error: dichLoi(error.code, `Không kiểm phiếu được: ${error.message}`) }
  }

  lamMoi(id)
  const kq = (data ?? {}) as { du_hop?: boolean; thong_qua?: boolean }
  if (!kq.du_hop) {
    return {
      ok: 'Đã kiểm phiếu. KHÔNG ĐỦ ĐIỀU KIỆN TIẾN HÀNH — kết quả này nói hội nghị chưa họp '
        + 'được, không nói cư dân đã bác nội dung. Muốn có nghị quyết thì phải mở lại cuộc khác.',
    }
  }
  return {
    ok: kq.thong_qua
      ? 'Đã kiểm phiếu. Nội dung ĐƯỢC THÔNG QUA. Con số vừa được chốt lại và không tính lại nữa.'
      : 'Đã kiểm phiếu. Hội nghị đủ điều kiện tiến hành nhưng nội dung KHÔNG ĐƯỢC THÔNG QUA.',
  }
}

export async function huyCuoc(_prev: BQState, formData: FormData): Promise<BQState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu cuộc biểu quyết.' }
  if (lyDo.length < 5) {
    return { error: 'Ghi lý do hủy — cuộc vẫn nằm lại trong sổ kèm dòng này.' }
  }

  const db = await createClient()
  const { error } = await db.rpc('huy_bieu_quyet', { p_bq: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23514') {
      return {
        error:
          'Cuộc này đã kiểm phiếu nên không hủy được — kết quả đã công bố, bỏ nó bằng một '
          + 'nút bấm là xóa một nghị quyết đã có hiệu lực. Cần sửa thì mở cuộc mới.',
      }
    }
    if (error.code === '23505') return { error: 'Cuộc này đã hủy rồi.' }
    return { error: dichLoi(error.code, `Không hủy được: ${error.message}`) }
  }

  lamMoi(id)
  return { ok: 'Đã hủy. Cuộc vẫn nằm lại trong sổ kèm lý do.' }
}

export async function huyPhieu(_prev: BQState, formData: FormData): Promise<BQState> {
  const phieu = String(formData.get('phieu') ?? '')
  const bq = String(formData.get('bq') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!phieu) return { error: 'Thiếu lá phiếu.' }
  if (lyDo.length < 5) {
    return { error: 'Ghi lý do hủy phiếu — có dòng này thì về sau phân biệt được "chủ căn bỏ nhầm" với "ai đó đổi phiếu của tôi".' }
  }

  const db = await createClient()
  const { error } = await db.rpc('huy_phieu_bieu_quyet', { p_phieu: phieu, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23514') return { error: 'Cuộc đã kiểm phiếu, không hủy phiếu được nữa.' }
    if (error.code === '23505') return { error: 'Lá phiếu này đã hủy rồi.' }
    return { error: dichLoi(error.code, `Không hủy được: ${error.message}`) }
  }

  lamMoi(bq)
  return { ok: 'Đã hủy phiếu. Căn đó bỏ lại được.' }
}
