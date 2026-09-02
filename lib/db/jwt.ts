/**
 * JWT HS256, tự ký — thay phần token của Supabase Auth.
 *
 * Chỉ dùng Web Crypto (crypto.subtle), không dùng node:crypto. Middleware của
 * Next chạy trên runtime Edge, ở đó không có node:crypto; viết hai bản cho hai
 * runtime là hai chỗ để lệch nhau, mà lệch ở hàm kiểm chữ ký nghĩa là một bên
 * nhận token mà bên kia từ chối — hoặc tệ hơn, ngược lại.
 *
 * Đây cũng chính là token mà PostgREST đọc: nó tự kiểm chữ ký bằng
 * PGRST_JWT_SECRET rồi SET ROLE theo claim `role` và đưa cả cụm claims vào
 * `request.jwt.claims`, chỗ mà auth.uid() đọc. Nên chữ ký ở đây không phải
 * chuyện nội bộ của app: nó là thứ quyết định RLS lọc theo ai.
 */

const B = new TextEncoder()

export type VaiTro = 'authenticated' | 'service_role'

export type Claims = {
  sub: string
  role: VaiTro
  iat: number
  exp: number
}

/** Thân token trước khi ký. `sub` vắng mặt là hợp lệ và có nghĩa: token
 *  service_role không đứng tên ai, nên auth.uid() phải trả NULL chứ không phải
 *  trả một uuid bịa. */
type Than = { sub?: string; role: VaiTro; iat: number; exp: number }

function mahoa(b: Uint8Array): string {
  let s = ''
  for (const n of b) s += String.fromCharCode(n)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Uint8Array<ArrayBuffer> chứ không phải Uint8Array trần: crypto.subtle chỉ
// nhận vùng nhớ KHÔNG chia sẻ, và Uint8Array.from() trả về kiểu chung cho cả
// SharedArrayBuffer nên TypeScript từ chối.
function giaima(s: string): Uint8Array<ArrayBuffer> {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  const b = atob(t + '='.repeat((4 - (t.length % 4)) % 4))
  const ra = new Uint8Array(new ArrayBuffer(b.length))
  for (let i = 0; i < b.length; i += 1) ra[i] = b.charCodeAt(i)
  return ra
}

async function khoa(biMat: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', B.encode(biMat), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  )
}

/** Ký token cho `sub` với vai `role`, sống `songGiay` giây.
 *  `sub` null: token không đứng tên ai — chỉ dùng cho service_role. */
export async function ky(
  sub: string | null, role: VaiTro, biMat: string, songGiay: number, bay = Date.now(),
): Promise<string> {
  const iat = Math.floor(bay / 1000)
  const than: Than = { ...(sub ? { sub } : {}), role, iat, exp: iat + songGiay }
  const dau = mahoa(B.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const giua = mahoa(B.encode(JSON.stringify(than)))
  const kySo = await crypto.subtle.sign('HMAC', await khoa(biMat), B.encode(`${dau}.${giua}`))
  return `${dau}.${giua}.${mahoa(new Uint8Array(kySo))}`
}

/**
 * Đọc token. Trả null nếu hỏng, sai chữ ký, hoặc hết hạn.
 *
 * KHÔNG bao giờ trả claims khi chữ ký sai, kể cả để "xem thử là ai". Phần giữa
 * của JWT là base64 chứ không phải mật mã — ai cũng sửa được `sub` thành người
 * khác rồi gửi lên. Chỉ chữ ký mới nói được token này do mình phát ra.
 */
export async function doc(
  token: string | undefined | null, biMat: string, bay = Date.now(),
): Promise<Claims | null> {
  if (!token) return null
  const phan = token.split('.')
  if (phan.length !== 3) return null
  const [dau, giua, chuKy] = phan
  try {
    const dung = await crypto.subtle.verify(
      'HMAC', await khoa(biMat), giaima(chuKy), B.encode(`${dau}.${giua}`),
    )
    if (!dung) return null
    const than = JSON.parse(new TextDecoder().decode(giaima(giua))) as Claims
    if (typeof than.sub !== 'string' || !than.sub) return null
    if (than.role !== 'authenticated' && than.role !== 'service_role') return null
    if (typeof than.exp !== 'number' || than.exp * 1000 <= bay) return null
    return than
  } catch {
    // base64 rác, JSON rác, chữ ký sai độ dài — tất cả đều là "không đăng nhập".
    return null
  }
}
