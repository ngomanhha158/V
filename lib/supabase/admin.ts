import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Client dùng service_role — BỎ QUA toàn bộ RLS.
 *
 * Chỉ được gọi trong route handler / server action chạy phía máy chủ. Khóa này
 * mà lọt xuống trình duyệt thì mọi thứ dựng trong auth_hooks.sql thành vô nghĩa:
 * người cầm nó đọc ghi được mọi bảng của mọi dự án.
 *
 * Hai lớp chặn: tên biến không có tiền tố NEXT_PUBLIC_ nên Next không nhét vào
 * bundle client; và hàm ném lỗi ngay nếu thấy mình đang chạy trong trình duyệt.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('service_role client khong duoc chay o trinh duyet')
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Thieu NEXT_PUBLIC_SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
