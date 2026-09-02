/**
 * Kiểm ĐƯỜNG THẬT đầu-cuối: Next → PostgREST → Postgres → RLS.
 *
 * Đây là mắt xích mà không bài test nào khác chạm tới. verify-schema và
 * verify-railway chứng minh phần SQL; chúng chạy trên PGlite trong tiến trình,
 * không có HTTP, không có PostgREST, không có JWT nào bị ai kiểm chữ ký. Nên
 * ba câu hỏi sau vẫn để ngỏ cho tới khi chạy file này:
 *
 *   1. PostgREST có nhận chữ ký của token do lib/db/jwt.ts ký không?
 *   2. Nó có SET ROLE đúng theo claim `role` không?
 *   3. `request.jwt.claims` nó đặt có đúng cái mà auth.uid() đang đọc không?
 *
 * Sai một trong ba là RLS lọc theo nhầm người — hoặc không lọc gì cả — mà app
 * vẫn chạy, vẫn trả dữ liệu, không có lỗi nào.
 *
 * Chạy:  POSTGREST_URL=… AUTH_JWT_SECRET=… npm run verify:http
 *
 * KHÔNG nằm trong `npm test`: nó cần một PostgREST đang sống. Chỗ dùng đúng
 * của nó là ngay sau khi deploy — xem railway/GD1-runbook.sh.
 *
 * Chỉ ĐỌC. Không tạo, không sửa, không xóa một dòng nào, nên chạy thẳng trên
 * database thật được.
 */
import { ky } from '../lib/db/jwt.ts'
import { taoClient } from '../lib/db/postgrest.ts'

const BI_MAT = process.env.AUTH_JWT_SECRET
if (!process.env.POSTGREST_URL || !BI_MAT) {
  console.error('Thiếu POSTGREST_URL hoặc AUTH_JWT_SECRET.')
  console.error('Cả hai phải đúng bằng giá trị mà service `v` đang chạy.')
  process.exit(2)
}

const KHONG_AI = '00000000-0000-0000-0000-0000000000ff'
let hong = 0
let chuaKiem = 0

function ok(ten: string) { console.log(`OK    ${ten}`) }
function xau(ten: string, vi: string) { console.error(`HỎNG  ${ten}\n      ${vi}`); hong += 1 }
function treo(ten: string, vi: string) { console.warn(`CHƯA  ${ten}\n      ${vi}`); chuaKiem += 1 }

const nguoi = async (uid: string) => taoClient(await ky(uid, 'authenticated', BI_MAT, 300), uid)
const mayChu = async () => taoClient(await ky(null, 'service_role', BI_MAT, 300), null)

// ── 1. Không token thì không có gì ────────────────────────────────────────────
// anon không được cấp một bảng nào trong auth_hooks.sql. Câu này phải LỖI, chứ
// không phải trả mảng rỗng: rỗng nghĩa là quyền đã mở và chỉ RLS đang lọc, mà
// RLS thì không áp cho người không có danh tính.
{
  const { data, error } = await taoClient(null, null).from('units').select('id').limit(1)
  if (error) ok('không token → PostgREST từ chối (anon không có bảng nào)')
  else xau('không token', `đọc được ${data?.length ?? 0} dòng units mà không cần đăng nhập`)
}

// ── 2. Chữ ký sai bị từ chối ─────────────────────────────────────────────────
// Nếu câu này qua được thì PGRST_JWT_SECRET đang lệch với AUTH_JWT_SECRET theo
// kiểu tệ nhất: PostgREST không kiểm chữ ký gì cả.
{
  const gia = await ky(KHONG_AI, 'service_role', `${BI_MAT}-sai`, 300)
  const { error } = await taoClient(gia, KHONG_AI).from('units').select('id').limit(1)
  if (error) ok('token ký bằng khóa khác → bị từ chối')
  else xau('token ký bằng khóa khác', 'PostgREST NHẬN token không phải của mình')
}

// ── 3. service_role đọc được (chứng minh SET ROLE theo claim `role`) ──────────
const may = await mayChu()
let duAn: string | null = null
{
  const { data, error } = await may.from('projects').select('id, name').limit(1).maybeSingle()
  if (error) xau('service_role đọc projects', error.message)
  else { duAn = data?.id ?? null; ok(`service_role đọc được projects (${data?.name ?? 'chưa có dự án'})`) }
}

// ── 4. Người lạ có token hợp lệ vẫn không thấy gì ────────────────────────────
// Đây là câu chốt cả ba câu hỏi ở đầu file cùng lúc: chữ ký nhận, role đúng là
// authenticated (không phải service_role), và auth.uid() đọc ra một người
// không sở hữu gì. Trả LỖI là hỏng (quyền chưa cấp); trả dòng cũng là hỏng.
{
  const la = await nguoi(KHONG_AI)
  const { data, error } = await la.from('invoices').select('id').limit(5)
  if (error) xau('người lạ đọc invoices', `phải trả 0 dòng, lại lỗi: ${error.message}`)
  else if ((data ?? []).length > 0) xau('người lạ đọc invoices', `thấy ${data!.length} hóa đơn của người khác`)
  else ok('người lạ có token hợp lệ → 0 hóa đơn, không lỗi')
}

// ── 5. RPC chạy được dưới quyền authenticated ────────────────────────────────
{
  const la = await nguoi(KHONG_AI)
  const { data, error } = await la.rpc('current_unit_ids')
  if (error) xau('rpc current_unit_ids', error.message)
  else if ((data ?? []).length !== 0) xau('rpc current_unit_ids', `người lạ mà có ${data!.length} căn`)
  else ok('rpc chạy dưới quyền authenticated → người lạ có 0 căn')
}

// ── 6. Cư dân thật thấy ĐÚNG căn của mình ────────────────────────────────────
// Số căn PostgREST trả về (qua RLS) phải khớp số căn đọc bằng service_role
// (không qua RLS). Lệch nghĩa là auth.uid() đang đọc nhầm người.
{
  const { data: tv } = await may
    .from('unit_memberships').select('user_id, unit_id')
    .eq('status', 'active').limit(1).maybeSingle()

  if (!tv?.user_id) {
    treo('cư dân thật thấy đúng căn của mình',
      'database chưa có unit_memberships nào đang hoạt động. Chạy lại file này '
      + 'sau khi duyệt chủ hộ đầu tiên — đây là ca quan trọng nhất.')
  } else {
    const { data: that } = await may
      .from('unit_memberships').select('unit_id')
      .eq('user_id', tv.user_id).eq('status', 'active')
    const mong = new Set((that ?? []).map((r) => r.unit_id))

    const toi = await nguoi(tv.user_id)
    const { data: cua, error } = await toi.rpc('current_unit_ids')
    if (error) {
      xau('cư dân thật gọi current_unit_ids', error.message)
    } else {
      const co = new Set(cua ?? [])
      const thua = [...co].filter((x) => !mong.has(x))
      // Thiếu thì có thể do valid_from/valid_to, không kết luận vội. THỪA thì
      // không có cách giải thích nào lành: người này đang thấy căn không phải
      // của mình.
      if (thua.length > 0) xau('cư dân thật', `thấy ${thua.length} căn KHÔNG thuộc về mình`)
      else if (co.size === 0) treo('cư dân thật', 'không thấy căn nào — có thể do hợp đồng đã hết hạn (valid_to)')
      else ok(`cư dân thật thấy đúng ${co.size} căn, không dư căn nào`)
    }
  }
}

// ── 7. Cư dân KHÔNG gọi được hàm đăng nhập ───────────────────────────────────
// Chốt quan trọng nhất về quyền. Đã có test ở tầng SQL (04_smoke_auth), nhưng
// đây là chỗ duy nhất chứng minh nó còn đứng sau khi đi qua PostgREST — nếu
// PGRST_DB_SCHEMAS lỡ mở thêm schema, hoặc role bị gán nhầm, thì tầng SQL vẫn
// xanh mà cửa thì đã mở.
{
  const la = await nguoi(KHONG_AI)
  const { error } = await la.rpc('auth_dat_mat_khau', { p_uid: KHONG_AI, p_mat_khau: 'x' })
  if (error) ok('cư dân gọi auth_dat_mat_khau → bị chặn')
  else xau('cư dân gọi auth_dat_mat_khau', 'GỌI ĐƯỢC — bất kỳ ai đăng nhập cũng đổi được mật khẩu của cả tòa')
}

// ── 8. service_role gọi được hàm THƯỜNG trong public ─────────────────────────
// Đây là ca đã bắt được lỗi thật. `revoke execute on all functions from public`
// trong auth_hooks.sql gỡ luôn cái quyền mà service_role vốn sống nhờ, mà trên
// Supabase thì không thấy vì bên đó cấp sẵn cho nó. Hệ quả: webhook ngân hàng
// và cả năm job nền cùng chết, im lặng.
//
// Phải chọn một hàm KHÔNG được cấp riêng cho service_role ở đâu cả — hàm có
// cấp riêng (auth_*) vẫn chạy được kể cả khi nền đã mất, nên nó không phát
// hiện ra gì.
{
  const { error } = await may.rpc('unit_project', { p_unit: KHONG_AI })
  if (error) {
    xau('service_role gọi hàm thường trong public',
      `${error.message} — webhook ngân hàng và mọi job nền sẽ hỏng y hệt`)
  } else ok('service_role gọi được hàm thường (đường của webhook và job nền)')
}

// ── 9. service_role đọc được bảng webhook ghi vào ────────────────────────────
{
  const { error } = await may.from('bank_transactions').select('id').limit(1)
  if (error) xau('service_role đọc bank_transactions', `${error.message} — đường tiền vào sẽ hỏng`)
  else ok('service_role đọc được bank_transactions')
}

// ── 10. service_role gọi được hàm đăng nhập ──────────────────────────────────
// Mặt còn lại của câu 7: chặn quá tay thì màn tạo tài khoản của BQL chết, và
// chết theo kiểu chỉ lộ ra lúc có người thật ngồi mời cư dân vào.
{
  const { error } = await may.rpc('auth_tim', { p_danh_tinh: 'khong-ton-tai@vbuilding.test' })
  if (error) xau('service_role gọi auth_tim', error.message)
  else ok('service_role gọi được hàm đăng nhập')
}

if (duAn === null) treo('dữ liệu', 'chưa có dự án nào — nhiều câu ở trên chưa chạm được dữ liệu thật')

console.log(
  hong === 0
    ? `\n${chuaKiem === 0 ? 'ĐƯỜNG THẬT THÔNG.' : `Đường thật thông, còn ${chuaKiem} ca CHƯA kiểm được (xem trên).`}`
    : `\n${hong} câu HỎNG — đừng mở cho cư dân dùng.`,
)
process.exit(hong === 0 ? 0 : 1)
