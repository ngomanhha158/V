import { PostgrestClient } from '@supabase/postgrest-js'
import type { Database } from './database.types.ts'
import { urlPostgrest } from './env.ts'

/**
 * Client nói chuyện với PostgREST.
 *
 * `.from(...)` và `.rpc(...)` giữ nguyên hình dạng cũ — vì đây CHÍNH LÀ thư
 * viện mà supabase-js vẫn dùng bên dưới. Bỏ Supabase là bỏ dịch vụ và bỏ
 * GoTrue, không phải viết lại 191 câu truy vấn: viết lại từng ấy chỗ để đổi
 * nhà cung cấp là tự tạo ra 191 cơ hội sai ở đúng những màn đang chạy được.
 *
 * `.auth.getUser()` là lớp mỏng bọc lại cho những chỗ đang gọi nó. Nó KHÔNG
 * gọi mạng: danh tính đã nằm sẵn trong token đã kiểm chữ ký, đọc thêm một
 * vòng nữa chỉ tốn thời gian chứ không biết thêm gì.
 */
export type Client = PostgrestClient<Database> & {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
}

export function taoClient(token: string | null, uid: string | null): Client {
  const c = new PostgrestClient<Database>(urlPostgrest(), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return Object.assign(c, {
    auth: { getUser: async () => ({ data: { user: uid ? { id: uid } : null } }) },
  })
}
