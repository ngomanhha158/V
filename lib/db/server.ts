import { cookies } from 'next/headers'
import { doc, type Claims } from './jwt'
import { biMatJwt } from './env'
import { TEN_COOKIE } from './phien'
import { taoClient, type Client } from './postgrest'

/** Claims của người đang đăng nhập, đã kiểm chữ ký. null nếu chưa đăng nhập. */
export async function phienHienTai(): Promise<{ token: string; claims: Claims } | null> {
  const token = (await cookies()).get(TEN_COOKIE)?.value
  if (!token) return null
  const claims = await doc(token, biMatJwt())
  return claims ? { token, claims } : null
}

/**
 * Client cho Server Component, Server Action và Route Handler.
 *
 * Chưa đăng nhập thì client vẫn dựng được nhưng không mang token, nên PostgREST
 * chạy request dưới role `anon` — mà auth_hooks.sql không cấp cho anon một bảng
 * nào. Tức là mọi truy vấn trả về lỗi quyền chứ không phải trả về mảng rỗng.
 * Hỏng ồn ào ở đây là đúng: một màn im lặng hiện "chưa có dữ liệu" cho người
 * chưa đăng nhập là màn nói dối.
 */
export async function createClient(): Promise<Client> {
  const p = await phienHienTai()
  return taoClient(p?.token ?? null, p?.claims.sub ?? null)
}
