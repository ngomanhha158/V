'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { createAdminClient } from '@/lib/db/admin'
import { normalizeEmail, toE164VN } from '@/lib/phone'

export type NguoiDungState = { error?: string; ok?: string }

/** Đúng các giá trị của enum staff_role. Form là HTML, ai cũng sửa được value
 *  rồi POST — không lọc ở đây thì Postgres từ chối bằng lỗi enum bằng tiếng
 *  Anh, mà đáng ra phải nói "vai trò không hợp lệ". */
const VAI_TRO_HOP_LE = [
  'bql_manager', 'bql_staff', 'technician', 'security', 'bqt',
] as const
type VaiTro = (typeof VAI_TRO_HOP_LE)[number]
const laVaiTro = (v: string): v is VaiTro =>
  (VAI_TRO_HOP_LE as readonly string[]).includes(v)

/** Ngắn hơn mức này là mật khẩu dùng chung cả tòa sẽ đoán ra trong một buổi. */
const DAI_TOI_THIEU = 8

/**
 * Chia việc giữa hai client, cố ý:
 *
 * - Client của NGƯỜI ĐANG ĐĂNG NHẬP làm mọi thứ đụng vào dữ liệu khu: kiểm
 *   quyền, gán vai trò, đọc danh sách. Chốt is_bql_manager nằm trong SQL nên
 *   không thể quên gọi.
 * - Client service_role CHỈ làm đúng thứ mà không ai khác được làm: tạo tài
 *   khoản trong auth.users và đặt mật khẩu. Nó bỏ qua toàn bộ RLS, nên càng ít
 *   việc đi qua nó thì càng ít chỗ sai.
 *
 * Thứ tự cũng cố ý: kiểm quyền TRƯỚC khi chạm vào admin client, không phải sau.
 */
async function guard(): Promise<
  { loi: string } | { db: Awaited<ReturnType<typeof createClient>>; project: string }
> {
  const db = await createClient()
  const project = await duAnBQL()
  if (!project) return { loi: 'Chưa có dự án nào trong hệ thống.' }

  const { data: laTruong } = await db.rpc('is_bql_manager', { p_project: project.id })
  if (!laTruong) return { loi: 'Chỉ trưởng ban quản lý mới quản lý được tài khoản.' }
  return { db, project: project.id }
}

/** Người này có thuộc dự án đang mở không. Thiếu chốt này thì trưởng BQL khu A
 *  đổi được mật khẩu của bất kỳ ai trong hệ thống, chỉ cần đoán đúng id. */
async function thuocDuAn(
  db: Awaited<ReturnType<typeof createClient>>, project: string, userId: string,
): Promise<boolean> {
  const { data } = await db.rpc('bql_danh_sach_nguoi_dung', { p_project: project })
  return (data ?? []).some((r) => r.user_id === userId)
}

/** Lỗi của Postgres sang tiếng Việt. Nguyên văn thì người trực ban không biết
 *  mình gõ trùng email hay hệ thống hỏng.
 *
 *  Khớp theo MÃ chứ không theo chuỗi: chuỗi lỗi của Postgres đổi theo phiên bản
 *  và theo locale của máy chủ, mã thì không. */
function dichLoiAdmin(loi: { code?: string; message?: string } | null): string {
  const ma = loi?.code ?? ''
  const msg = loi?.message ?? 'không rõ nguyên nhân'
  if (ma === '23505') return 'Email hoặc số điện thoại này đã có tài khoản rồi.'
  if (ma === '23503') {
    return 'Người này đang được gán vào căn hộ hoặc vào ban quản lý nên chưa gỡ được.'
  }
  if (ma === '42883' || ma === '42P01') {
    return 'Lớp đăng nhập chưa có trên database. Chạy railway/03_auth.sql rồi thử lại.'
  }
  if (ma === '42501') {
    return 'Máy chủ không đủ quyền gọi hàm tạo tài khoản. Kiểm tra lại phần quyền '
      + 'ở cuối railway/03_auth.sql.'
  }
  return `Không tạo được tài khoản: ${msg}`
}

export async function taoTaiKhoan(
  _prev: NguoiDungState, formData: FormData,
): Promise<NguoiDungState> {
  const g = await guard()
  if ('loi' in g) return { error: g.loi }
  const { db, project } = g

  const hoTen = String(formData.get('ho_ten') ?? '').trim()
  const danhTinh = String(formData.get('danh_tinh') ?? '').trim()
  const matKhau = String(formData.get('mat_khau') ?? '')
  const loai = String(formData.get('loai') ?? '')
  const vaiTro = String(formData.get('vai_tro') ?? '')
  const can = String(formData.get('can') ?? '')

  if (!hoTen) return { error: 'Chưa nhập họ tên.' }
  if (matKhau.length < DAI_TOI_THIEU) {
    return { error: `Mật khẩu phải từ ${DAI_TOI_THIEU} ký tự trở lên.` }
  }
  if (loai === 'nhan_su' && !laVaiTro(vaiTro)) return { error: 'Vai trò không hợp lệ.' }
  if (loai === 'cu_dan' && !can) return { error: 'Chưa chọn căn hộ.' }

  // Cho phép cả email lẫn số điện thoại: khu nào cũng có người không dùng email.
  const email = danhTinh.includes('@') ? normalizeEmail(danhTinh) : null
  const phone = danhTinh.includes('@') ? null : toE164VN(danhTinh)
  if (!email && !phone) {
    return { error: 'Email hoặc số điện thoại không hợp lệ. Số di động nhập 10 chữ số, ví dụ 0901234567.' }
  }

  let admin
  try {
    admin = await createAdminClient()
  } catch (e) {
    // Nói thẳng ra là thiếu cấu hình chứ không để người trực ban tưởng mình gõ sai.
    return { error: `Máy chủ chưa cấu hình xong nên chưa tạo được tài khoản. ${(e as Error).message}` }
  }

  // Tài khoản do BQL tạo là đã xác nhận sẵn (auth_tao_nguoi_dung tự đặt
  // xac_nhan_luc). Đây là cả lý do màn này tồn tại — bắt mỗi hộ chờ một lá thư
  // xác nhận thì mời 24 hộ mất nửa ngày, và hộ nào không nhận được thư là kẹt.
  const { data: uid, error: loiTao } = await admin.rpc('auth_tao_nguoi_dung', {
    p_email: email ?? '', p_phone: phone ?? '', p_ho_ten: hoTen, p_mat_khau: matKhau,
  })
  if (loiTao || !uid) return { error: dichLoiAdmin(loiTao) }

  // Gán vai trò bằng client của NGƯỜI ĐANG ĐĂNG NHẬP, không phải admin client:
  // chốt is_bql_manager trong SQL vẫn phải áp cho thao tác này.
  const { error: loiGan } = loai === 'nhan_su'
    ? await db.rpc('bql_gan_nhan_su',
        { p_user: uid, p_project: project, p_role: vaiTro as VaiTro })
    : await db.rpc('bql_gan_chu_ho_dau_tien', { p_user: uid, p_unit: can })

  if (loiGan) {
    // Tài khoản đã tạo nhưng chưa gắn vào đâu -> xóa đi. Để lại là một tài
    // khoản đăng nhập được mà không thuộc khu nào, không hiện trong danh sách
    // nên không ai gỡ, và chiếm mất email đó vĩnh viễn.
    await admin.rpc('auth_xoa_nguoi_dung', { p_uid: uid })
    if (loiGan.code === '42501') {
      return { error: 'Không gán được: căn này đã có chủ hộ, hoặc bạn không đủ quyền. Tài khoản vừa tạo đã được hủy.' }
    }
    return { error: `Không gán được vai trò: ${loiGan.message}. Tài khoản vừa tạo đã được hủy.` }
  }

  revalidatePath('/bql/nguoi-dung')
  revalidatePath('/bql/go-live')
  return { ok: `Đã tạo tài khoản cho ${hoTen}. Báo họ đăng nhập bằng ${email ?? danhTinh} và mật khẩu vừa đặt.` }
}

export async function datLaiMatKhau(
  _prev: NguoiDungState, formData: FormData,
): Promise<NguoiDungState> {
  const g = await guard()
  if ('loi' in g) return { error: g.loi }
  const { db, project } = g

  const uid = String(formData.get('user_id') ?? '')
  const hoTen = String(formData.get('ho_ten') ?? '')
  const matKhau = String(formData.get('mat_khau') ?? '')
  if (!uid) return { error: 'Thiếu người cần đổi mật khẩu.' }
  if (matKhau.length < DAI_TOI_THIEU) {
    return { error: `Mật khẩu phải từ ${DAI_TOI_THIEU} ký tự trở lên.` }
  }
  if (!(await thuocDuAn(db, project, uid))) {
    return { error: 'Người này không thuộc dự án của bạn.' }
  }

  let admin
  try {
    admin = await createAdminClient()
  } catch (e) {
    return { error: `Máy chủ chưa cấu hình xong nên chưa đổi được mật khẩu. ${(e as Error).message}` }
  }
  const { data: xong, error } = await admin.rpc('auth_dat_mat_khau', {
    p_uid: uid, p_mat_khau: matKhau,
  })
  if (error) return { error: dichLoiAdmin(error) }
  if (!xong) return { error: 'Không tìm thấy tài khoản này nữa. Tải lại danh sách.' }

  revalidatePath('/bql/nguoi-dung')
  return { ok: `Đã đặt lại mật khẩu cho ${hoTen || 'người dùng'}. Báo trực tiếp cho họ, đừng gửi qua nhóm chat chung.` }
}

export async function ngungNhanSu(
  _prev: NguoiDungState, formData: FormData,
): Promise<NguoiDungState> {
  const g = await guard()
  if ('loi' in g) return { error: g.loi }
  const { db, project } = g

  const uid = String(formData.get('user_id') ?? '')
  const vaiTro = String(formData.get('vai_tro') ?? '')
  const hoTen = String(formData.get('ho_ten') ?? '')
  if (!uid) return { error: 'Thiếu người cần thu hồi.' }
  if (!laVaiTro(vaiTro)) return { error: 'Vai trò không hợp lệ.' }

  const { error } = await db.rpc('bql_ngung_nhan_su',
    { p_user: uid, p_project: project, p_role: vaiTro })
  if (error) {
    if (error.code === '42501') {
      return { error: 'Không thu hồi được: đây là trưởng ban quản lý duy nhất của dự án. Cấp quyền cho người khác trước đã.' }
    }
    return { error: `Không thu hồi được: ${error.message}` }
  }

  revalidatePath('/bql/nguoi-dung')
  revalidatePath('/bql/go-live')
  return { ok: `Đã thu hồi vai trò ${vaiTro} của ${hoTen || 'người này'}.` }
}
