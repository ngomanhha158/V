import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/db/admin'
import { bangNhau } from '@/lib/bi-mat'
import { kiemCauHinh, urlPostgrest } from '@/lib/db/env'
import { goYNguoiSua, phanLoaiLoiHeThong } from '@/lib/auth-loi'
import { kiemCauHinhPush } from '@/lib/push'

/**
 * Chẩn đoán đường đi tới database — cho NGƯỜI DỰNG HỆ THỐNG, không cho cư dân.
 *
 * Vì sao cần, dù đã có /api/health: health cố ý KHÔNG chạm database (chạm thì
 * một sự cố ở tầng dữ liệu làm Railway giết container). Nên nó trả lời được
 * "tiến trình còn sống" và "biến môi trường đã đặt", mà không trả lời được câu
 * hay hỏng nhất: hai khoá JWT có KHỚP NHAU không.
 *
 * Đó là lỗ thật, gặp thật: màn đăng nhập báo "hệ thống đang không đọc được dữ
 * liệu đăng nhập" — đúng và trung thực với cư dân, nhưng người đi sửa thì phải
 * mở log Railway mới biết là khoá lệch, hay chưa chạy 03_auth.sql, hay quên
 * notify pgrst. Ba nguyên nhân, một triệu chứng.
 *
 * KHÓA BẰNG CRON_SECRET, không phải phiên đăng nhập: đây là màn phải dùng được
 * ĐÚNG LÚC không ai đăng nhập nổi. Và không bao giờ trả về giá trị của biến
 * nào — chỉ trả về nó có hoạt động hay không.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Buoc = { ten: string; ok: boolean; chi_tiet: string }

export async function POST(req: NextRequest) {
  const bimat = process.env.CRON_SECRET
  if (!bimat) {
    return NextResponse.json({ loi: 'Chưa cấu hình CRON_SECRET.' }, { status: 503 })
  }
  if (!bangNhau(req.headers.get('x-cron-key') ?? '', bimat)) {
    return NextResponse.json({ loi: 'Sai khóa.' }, { status: 401 })
  }

  const buoc: Buoc[] = []
  const them = (ten: string, ok: boolean, chi_tiet: string) => buoc.push({ ten, ok, chi_tiet })

  // ── 1. Biến môi trường ──
  const thieu = kiemCauHinh()
  them('bien-moi-truong', thieu.length === 0,
    thieu.length ? thieu.join(' | ') : 'POSTGREST_URL và AUTH_JWT_SECRET đã có')
  if (thieu.length > 0) return NextResponse.json({ ok: false, buoc }, { status: 200 })

  // ── 2. PostgREST có tới được không ──
  // Tách riêng khỏi bước 3: "không tới được" và "tới được nhưng từ chối token"
  // là hai việc phải sửa ở hai chỗ khác hẳn nhau.
  let toiDuoc = false
  try {
    const r = await fetch(urlPostgrest(), { signal: AbortSignal.timeout(5000) })
    toiDuoc = true
    them('postgrest-toi-duoc', true, `HTTP ${r.status} từ ${urlPostgrest()}`)
  } catch (e) {
    them('postgrest-toi-duoc', false,
      `Không nối được tới ${urlPostgrest()}: ${(e as Error).message}. `
      + 'Kiểm tên service trong POSTGREST_URL, và PGRST_SERVER_HOST phải là :: '
      + '(mặc định PostgREST chỉ nghe IPv4, mạng nội bộ Railway là IPv6).')
  }
  if (!toiDuoc) return NextResponse.json({ ok: false, buoc }, { status: 200 })

  const db = await createAdminClient()

  // ── 3. TOKEN CỦA APP CÓ ĐƯỢC CHẤP NHẬN KHÔNG ──
  // Đây là câu mà không màn nào khác trả lời được. Đọc một bảng bất kỳ bằng
  // token service_role: hỏng ở tầng khoá thì PostgREST từ chối, và lỗi nói
  // "JWT" chứ không nói "thiếu quyền".
  //
  // DÙNG CHUNG phanLoaiLoiHeThong với màn đăng nhập, không tự khớp mẫu ở đây
  // nữa. Trước đây mỗi bên một bộ mẫu riêng, và cả hai cùng gộp "PostgREST
  // không có khoá" vào "hai khoá lệch nhau" — hai chỗ sai giống hệt nhau nên
  // đối chiếu chúng với nhau cũng không lòi ra. Một bộ óc thì sửa một lần là
  // cả hai màn cùng đúng.
  {
    const { error } = await db.from('projects').select('id').limit(1)
    const loi = error?.message ?? ''
    const tt = error ? phanLoaiLoiHeThong(error) : null
    them('khoa-jwt-khop', !error,
      !error ? 'PostgREST nhận token do app ký — AUTH_JWT_SECRET khớp PGRST_JWT_SECRET'
        : `PostgREST TỪ CHỐI token (${error.code || 'khong-ro'}: ${loi}). `
          + (goYNguoiSua(tt as string) ?? `Đọc bảng projects hỏng: ${loi}`))
    // DỪNG Ở ĐÂY nếu token bị từ chối. Chạy tiếp thì mọi bước sau cũng đỏ vì
    // đúng cái lý do này, và bốn dòng đỏ giống nhau làm người đọc mất công loại
    // trừ đúng thứ mà bước này vừa chỉ tận nơi.
    if (error) return NextResponse.json({ ok: false, buoc }, { status: 200 })
  }

  // ── 4. Lớp đăng nhập đã áp chưa ──
  // Gọi thật auth_kiem_mat_khau với một danh tính không tồn tại: hàm có mặt thì
  // trả null (không phải lỗi); chưa áp 03_auth.sql hoặc chưa notify pgrst thì
  // PostgREST trả 404 cho đúng cái tên vừa gọi.
  {
    const { error } = await db.rpc('auth_kiem_mat_khau', {
      p_danh_tinh: 'chan-doan-khong-ton-tai@example.invalid',
      p_mat_khau: 'khong-phai-mat-khau-that',
    })
    const loi = error?.message ?? ''
    const khongThay = error?.code === 'PGRST202' || /could not find|does not exist|schema cache/i.test(loi)
    them('lop-dang-nhap', !error,
      !error ? 'auth_kiem_mat_khau gọi được — đây là hàm màn đăng nhập dùng'
        : khongThay
          ? `PostgREST không thấy auth_kiem_mat_khau: ${loi}. Hoặc chưa chạy `
            + 'railway/03_auth.sql, hoặc đã chạy mà quên: notify pgrst, \'reload schema\''
          : `auth_kiem_mat_khau lỗi: ${loi}`)
  }

  // ── 5. Có ai là ban quản lý chưa ──
  // Không phải lỗi hạ tầng, nhưng là cửa cuối cùng trước khi dùng được: không
  // có ai là BQL thì đăng nhập xong mọi màn /bql đều đóng.
  {
    const { count, error } = await db
      .from('staff_assignments').select('user_id', { count: 'exact', head: true }).eq('is_active', true)
    them('co-ban-quan-ly', !error && (count ?? 0) > 0,
      error ? `Không đọc được staff_assignments: ${error.message}`
        : (count ?? 0) > 0 ? `${count} phân công còn hiệu lực`
          : 'Chưa có ai là BQL. Chạy auth_tao_nguoi_dung rồi bootstrap_bql.sql.')
  }

  // ── 6. Thông báo đẩy (không chặn đăng nhập, chỉ báo để biết) ──
  const thieuPush = kiemCauHinhPush()
  them('thong-bao-day', thieuPush.length === 0,
    thieuPush.length === 0 ? 'Khoá VAPID đã có'
      : `Chưa bật: ${thieuPush.length} biến còn thiếu. Thông báo vẫn nằm trong app, `
        + 'chỉ là điện thoại không rung.')

  // `ok` chỉ tính năm bước đầu — push thiếu thì app vẫn dùng được.
  const ok = buoc.slice(0, 5).every((b) => b.ok)
  return NextResponse.json({ ok, buoc }, { status: 200 })
}
