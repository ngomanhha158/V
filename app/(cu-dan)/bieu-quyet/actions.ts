'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { Y_KIEN, type YKien } from '@/lib/bieu-quyet'

export type PhieuState = { error?: string; ok?: string }

export async function boPhieu(_prev: PhieuState, formData: FormData): Promise<PhieuState> {
  const bq = String(formData.get('bq') ?? '')
  const unit = String(formData.get('unit') ?? '')
  const yKien = String(formData.get('y_kien') ?? '')
  if (!bq || !unit) return { error: 'Thiếu cuộc biểu quyết hoặc căn hộ.' }
  if (!Y_KIEN.includes(yKien as YKien)) return { error: 'Chưa chọn ý kiến.' }

  const db = await createClient()
  const { error } = await db.rpc('bo_phieu_bieu_quyet', {
    p_bq: bq, p_unit: unit, p_y_kien: yKien,
  })
  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Căn này đã bỏ phiếu rồi. Phiếu không sửa được — bỏ nhầm thì nhờ ban quản trị '
          + 'hủy phiếu, họ phải ghi lý do và tên họ nằm lại trong sổ.',
      }
    }
    if (error.code === '23514') return { error: 'Cuộc biểu quyết này đã đóng hoặc đã hủy.' }
    if (error.code === '42501') {
      return {
        error:
          'Chỉ CHỦ SỞ HỮU hoặc người được chủ sở hữu ủy quyền mới bỏ phiếu được. '
          + 'Người thuê và người nhà thì không — nghị quyết có phiếu của người thuê là '
          + 'nghị quyết bị bác ngay khi có ai đó soi lại.',
      }
    }
    if (error.code === '42883' || error.code === '42P01') {
      return { error: 'Phần biểu quyết chưa có trên database. Báo ban quản lý.' }
    }
    return { error: `Không bỏ phiếu được: ${error.message}` }
  }

  revalidatePath(`/bieu-quyet/${bq}`)
  revalidatePath('/bieu-quyet')
  revalidatePath(`/bql/bieu-quyet/${bq}`)
  return { ok: 'Đã ghi phiếu của bạn.' }
}
