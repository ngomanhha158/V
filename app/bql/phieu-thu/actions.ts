'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type PhieuThuState = { error?: string; ok?: string }

export async function huyPhieu(_prev: PhieuThuState, formData: FormData): Promise<PhieuThuState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu phiếu cần hủy.' }
  // Chặn ở đây để câu nhắc nói đúng việc phải làm, thay vì để Postgres trả về
  // 22023 rồi dịch ngược lại thành một câu chung chung.
  if (lyDo.length < 5) {
    return {
      error:
        'Ghi lý do hủy — ít nhất vài chữ. Số chứng từ này đã đưa cho cư dân, ' +
        'người tra sổ về sau cần biết vì sao nó không còn giá trị.',
    }
  }

  const db = await createClient()
  const { error } = await db.rpc('huy_phieu_thu', { p_phieu: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '42501') return { error: 'Chỉ ban quản lý của dự án này mới hủy được phiếu thu.' }
    if (error.code === '23505') return { error: 'Phiếu này đã hủy rồi.' }
    if (error.code === '42883' || error.code === '42P01') {
      return { error: 'Phần phiếu thu chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.' }
    }
    return { error: `Không hủy được: ${error.message}` }
  }

  revalidatePath('/bql/phieu-thu')
  return {
    ok:
      'Đã hủy phiếu. Số chứng từ đó KHÔNG được cấp lại cho phiếu khác, và khoản ' +
      'tiền vẫn nguyên trong hệ thống — nếu ghi sai căn thì gạch lại ở màn Đối soát tiền về.',
  }
}
