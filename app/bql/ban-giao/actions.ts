'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type BanGiaoState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Chỉ trưởng ban quản lý hoặc thành viên ban quản trị mới làm được việc này.'
  if (code === '42883' || code === '42P01') {
    return 'Phần chốt sổ bàn giao chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

export async function lapChot(_prev: BanGiaoState, formData: FormData): Promise<BanGiaoState> {
  const project = String(formData.get('project') ?? '')
  const ngay = String(formData.get('ngay') ?? '')
  if (!project) return { error: 'Chưa có dự án.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { error: 'Chưa chọn ngày chốt.' }

  const db = await createClient()
  const { error } = await db.rpc('lap_chot_ban_giao', {
    p_project: project, p_ngay: ngay,
    p_ghi_chu: String(formData.get('ghi_chu') ?? '').trim() || null,
  })
  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Đã có bản chốt cho ngày này rồi. Hai bản cho cùng một ngày là hai con số khác nhau '
          + 'cùng tự xưng là sự thật của ngày đó — hủy bản cũ trước nếu cần lập lại.',
      }
    }
    if (error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không lập được: ${error.message}`) }
  }

  revalidatePath('/bql/ban-giao')
  revalidatePath('/ban-giao')
  return { ok: 'Đã chốt. Số liệu từ giờ đóng băng — hai bên đọc lại rồi ký.' }
}

export async function kyChot(_prev: BanGiaoState, formData: FormData): Promise<BanGiaoState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Thiếu bản chốt.' }

  const db = await createClient()
  const { data, error } = await db.rpc('ky_chot_ban_giao', { p_chot: id })
  if (error) {
    if (error.code === '23505') return { error: 'Bên của bạn đã ký bản này rồi.' }
    if (error.code === '23514') return { error: 'Bản chốt này đã hủy, không ký được.' }
    return { error: dichLoi(error.code, `Không ký được: ${error.message}`) }
  }

  revalidatePath('/bql/ban-giao')
  revalidatePath('/ban-giao')
  // Nói ra ĐÃ KÝ VÀO Ô NÀO. Người kiêm cả hai vai không tự chọn được bên, nên
  // họ cần biết hệ thống vừa ghi họ là bên nào.
  return {
    ok: data === 'bqt'
      ? 'Đã ký với tư cách BAN QUẢN TRỊ. Một người không ký được cả hai bên.'
      : 'Đã ký với tư cách BAN QUẢN LÝ. Một người không ký được cả hai bên.',
  }
}

export async function huyChot(_prev: BanGiaoState, formData: FormData): Promise<BanGiaoState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu bản chốt.' }
  if (lyDo.length < 5) return { error: 'Ghi lý do hủy — bản chốt vẫn nằm lại trong sổ kèm dòng này.' }

  const db = await createClient()
  const { error } = await db.rpc('huy_chot_ban_giao', { p_chot: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23514') {
      return {
        error:
          'Hai bên đã ký nên không hủy được — bỏ nó bằng nút bấm của một bên là xóa chữ ký '
          + 'của bên kia. Cần sửa thì lập bản chốt mới cho một mốc khác.',
      }
    }
    if (error.code === '23505') return { error: 'Bản chốt này đã hủy rồi.' }
    return { error: dichLoi(error.code, `Không hủy được: ${error.message}`) }
  }

  revalidatePath('/bql/ban-giao')
  revalidatePath('/ban-giao')
  return { ok: 'Đã hủy. Bản chốt vẫn nằm lại trong sổ kèm lý do.' }
}
