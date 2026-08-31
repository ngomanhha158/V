'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DuyetState = { error?: string; ok?: string }

export async function duyetChuHo(
  _prev: DuyetState, formData: FormData,
): Promise<DuyetState> {
  const id = String(formData.get('membership') ?? '')
  const ten = String(formData.get('ten') ?? '')
  const can = String(formData.get('can') ?? '')
  if (!id) return { error: 'Thiếu yêu cầu.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('bql_duyet_chu_ho_dau_tien', { p_membership: id })

  if (error) {
    // Ba lỗi này người trực gây ra được bằng thao tác bình thường: mở hai tab,
    // bấm hai lần, hoặc chủ hộ vừa được duyệt ở máy khác. Nói ra nghĩa thay vì
    // ném nguyên lỗi Postgres.
    if (error.code === '22023') return { error: 'Yêu cầu này vừa được xử lý ở nơi khác.' }
    if (error.code === '42501') {
      return { error: 'Không duyệt được: căn đã có chủ hộ, hoặc đây không phải yêu cầu làm chủ hộ.' }
    }
    return { error: `Không duyệt được: ${error.message}` }
  }

  revalidatePath('/bql/duyet-chu-ho')
  revalidatePath('/bql/go-live')
  return { ok: `Đã duyệt ${ten || 'cư dân'} làm chủ hộ căn ${can}.` }
}
