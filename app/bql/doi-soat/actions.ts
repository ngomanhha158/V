'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DoiSoatState = { error?: string; ok?: string }

/** Gạch tay một giao dịch vào công nợ của một căn. */
export async function ganGiaoDich(
  _prev: DoiSoatState, formData: FormData,
): Promise<DoiSoatState> {
  const txn = String(formData.get('txn') ?? '')
  const unit = String(formData.get('unit') ?? '')
  if (!txn) return { error: 'Thiếu giao dịch.' }
  if (!unit) return { error: 'Chưa chọn căn hộ để gạch.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('bql_gan_giao_dich', {
    p_txn: txn, p_unit: unit,
  })

  if (error) {
    // Hai lỗi này người dùng gây ra được bằng thao tác bình thường (bấm hai
    // lần, hai người cùng làm), nên phải nói ra nghĩa thay vì ném lỗi Postgres.
    if (error.code === '23505') return { error: 'Giao dịch này đã được gạch rồi.' }
    if (error.code === '42501') return { error: 'Không có quyền, hoặc căn không thuộc dự án này.' }
    return { error: `Không gạch được: ${error.message}` }
  }

  const kq = data as { da_gach?: number; so_hoa_don?: number; con_du?: number } | null
  const du = kq?.con_du ?? 0
  revalidatePath('/bql/doi-soat')
  revalidatePath('/bql/cong-no')
  return {
    ok: `Đã gạch ${(kq?.da_gach ?? 0).toLocaleString('vi-VN')}đ vào ${kq?.so_hoa_don ?? 0} hóa đơn`
      + (du > 0 ? `, còn dư ${du.toLocaleString('vi-VN')}đ.` : '.'),
  }
}

/** Đánh dấu giao dịch không phải tiền cư dân. */
export async function boQuaGiaoDich(
  _prev: DoiSoatState, formData: FormData,
): Promise<DoiSoatState> {
  const txn = String(formData.get('txn') ?? '')
  const ghiChu = String(formData.get('ghi_chu') ?? '').trim()
  if (!txn) return { error: 'Thiếu giao dịch.' }
  if (!ghiChu) return { error: 'Phải ghi lý do bỏ qua.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('bql_bo_qua_giao_dich', {
    p_txn: txn, p_ghi_chu: ghiChu,
  })
  if (error) {
    if (error.code === '23505') return { error: 'Giao dịch đã gạch vào hóa đơn, không bỏ qua được.' }
    if (error.code === '42501') return { error: 'Không có quyền đối soát dự án này.' }
    return { error: `Không bỏ qua được: ${error.message}` }
  }

  revalidatePath('/bql/doi-soat')
  return { ok: 'Đã đánh dấu bỏ qua.' }
}
