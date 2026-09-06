'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type TkState = { loi?: string; xong?: string }

/**
 * Khai tài khoản nhận tiền của khu.
 *
 * Cửa quyền thật nằm trong `dat_tk_nhan_tien` (chỉ trưởng BQL) — ở đây chỉ
 * dịch lỗi sang tiếng người. Kiểm ở màn hình mà không kiểm ở database thì ai
 * gọi thẳng RPC là qua được, và thứ họ đổi là chỗ tiền của cả tòa chảy về.
 */
export async function datTaiKhoan(_prev: TkState, formData: FormData): Promise<TkState> {
  const project = String(formData.get('khu') ?? '')
  if (!project) return { loi: 'Chưa biết đang khai cho khu nào.' }

  const db = await createClient()
  const { error } = await db.rpc('dat_tk_nhan_tien', {
    p_project: project,
    p_bin: String(formData.get('bin') ?? ''),
    p_so_tk: String(formData.get('so_tk') ?? ''),
    p_ten: String(formData.get('chu_tk') ?? ''),
  })

  if (error) {
    if (error.code === '42501') return { loi: 'Chỉ trưởng BQL mới đổi được tài khoản nhận tiền.' }
    if (error.code === '22023') return { loi: 'Phải điền cả mã ngân hàng (BIN) lẫn số tài khoản.' }
    if (error.code === '23505') {
      return { loi: 'Số tài khoản này đã khai cho một khu khác. Mỗi khu một tài khoản — trùng thì không biết tiền về là của khu nào.' }
    }
    if (error.code === '23514') {
      return { loi: 'BIN phải đúng 6 chữ số, số tài khoản từ 4 tới 32 chữ số.' }
    }
    return { loi: error.message }
  }

  revalidatePath('/bql/khu')
  return { xong: 'Đã lưu. Từ giờ mã QR trên hóa đơn của khu này trỏ vào tài khoản đó.' }
}
