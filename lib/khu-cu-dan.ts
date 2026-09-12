import { createClient } from '@/lib/db/server'
import { danhSach } from '@/lib/chot-quyen'

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
  // `data ?? []` ở đây từng có nghĩa: một lần đọc hỏng hiện ra thành "bạn
  // không ở khu nào". Cư dân đọc câu đó sẽ hiểu là căn hộ của họ đã bị gỡ khỏi
  // hệ thống — và gọi ngay cho ban quản lý.
  return danhSach<KhuO>(await db.rpc('khu_toi_o'), 'khu_toi_o')
}
