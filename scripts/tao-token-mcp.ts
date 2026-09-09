/**
 * Phát token cho MCP server. CHẠY TRÊN RAILWAY, không chạy trên máy cá nhân.
 *
 * Đây là mảnh giữ cho AUTH_JWT_SECRET không bao giờ rời khỏi máy chủ. Khoá ký
 * là khoá của CẢ hệ thống: ai cầm nó ký được token cho bất kỳ ai, kể cả
 * service_role vốn bỏ qua toàn bộ RLS. Đưa nó xuống laptop để MCP tự ký là
 * đánh đổi sai — một máy bị mất là mất cả toà nhà.
 *
 * Token phát ra ở đây mang vai `authenticated` và `sub` của ĐÚNG một người.
 * Nghĩa là nó mạnh đúng bằng cookie phiên đang nằm trong trình duyệt người đó,
 * không hơn: mọi truy vấn vẫn đi qua RLS y như trên web.
 *
 * Chạy:  npx tsx scripts/tao-token-mcp.ts <email>
 */
import { ky } from '../lib/db/jwt.ts'
import { taoClient } from '../lib/db/postgrest.ts'
import { biMatJwt, PHIEN_SONG_GIAY, SERVICE_SONG_GIAY } from '../lib/db/env.ts'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('Thiếu email. Chạy: npx tsx scripts/tao-token-mcp.ts <email>')
  process.exit(1)
}

const biMat = biMatJwt()
// Token service_role sống 60 giây, CHỈ để tra uid. Không ghi gì.
const db = taoClient(await ky(null, 'service_role', biMat, SERVICE_SONG_GIAY), null)
const { data, error } = await db.from('profiles').select('id, full_name').eq('email', email).maybeSingle()

if (error) {
  console.error(`Không đọc được profiles: ${error.code ?? ''} ${error.message}`)
  process.exit(1)
}
if (!data) {
  console.error(`Không có tài khoản nào với email ${email}. Tạo trước bằng auth_tao_nguoi_dung.`)
  process.exit(1)
}

const token = await ky(data.id, 'authenticated', biMat, PHIEN_SONG_GIAY)
const hetHan = new Date(Date.now() + PHIEN_SONG_GIAY * 1000)

console.error(`Token cho ${data.full_name} <${email}>`)
console.error(`Hết hạn ${hetHan.toISOString().slice(0, 10)} (30 ngày, đúng bằng phiên web).`)
console.error('Dán vào VBUILDING_TOKEN của MCP. KHÔNG dán AUTH_JWT_SECRET.\n')
// Chỉ token ra stdout, để `... > /dev/null` hay pipe được mà không lẫn chữ.
console.log(token)
