import { ky } from './jwt'
import { biMatJwt, SERVICE_SONG_GIAY } from './env'
import { taoClient, type Client } from './postgrest'

/**
 * Client dùng service_role — BỎ QUA toàn bộ RLS.
 *
 * Chỉ được gọi trong route handler / server action chạy phía máy chủ. Token này
 * mà lọt xuống trình duyệt thì mọi thứ dựng trong auth_hooks.sql thành vô nghĩa:
 * người cầm nó đọc ghi được mọi bảng của mọi dự án.
 *
 * Ba lớp chặn:
 *  • AUTH_JWT_SECRET không có tiền tố NEXT_PUBLIC_ nên Next không nhét vào
 *    bundle client;
 *  • hàm ném lỗi ngay nếu thấy mình đang chạy trong trình duyệt;
 *  • token ký ra chỉ sống 60 giây — có lọt ra ngoài thì cũng không thành một
 *    chiếc chìa khóa dùng được lâu dài, khác hẳn khóa service_role của Supabase
 *    vốn không hết hạn cho tới khi có người nhớ ra mà xoay.
 */
export async function createAdminClient(): Promise<Client> {
  if (typeof window !== 'undefined') {
    throw new Error('client service_role khong duoc chay o trinh duyet')
  }
  // KHÔNG có claim `sub`: auth.uid() trả NULL, đúng như sự thật — không ai
  // đứng sau thao tác này. Nhét một uuid vào đây là mời hàm SECURITY DEFINER
  // nào đó tưởng có người thật rồi ghi tên người đó vào sổ.
  const token = await ky(null, 'service_role', biMatJwt(), SERVICE_SONG_GIAY)
  return taoClient(token, null)
}
