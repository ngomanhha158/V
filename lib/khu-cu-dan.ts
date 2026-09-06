import { createClient } from '@/lib/db/server'

/**
 * Các khu cư dân đang ở.
 *
 * Đối xứng với `du_an_cua_toi()` bên BQL, nhưng KHÔNG kèm hộp chọn. Cư dân
 * không "trực" ở khu nào — họ chỉ có vài căn, và thứ họ cần là nhìn thấy hết
 * cùng lúc. Người một khu thấy đúng như trước; người hai khu thấy hai khối,
 * mỗi khối ghi tên khu.
 */
export type KhuO = { id: string; name: string }

export async function khuToiO(): Promise<KhuO[]> {
  const db = await createClient()
  const { data } = await db.rpc('khu_toi_o')
  return (data ?? []) as KhuO[]
}
