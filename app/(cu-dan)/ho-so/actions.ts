'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { cauTaiKhoan, chuanHoaLienLac, loiDoiLienLac, loiDoiMatKhau } from '@/lib/tai-khoan'

export type HoSoState = { error?: string; ok?: string }

/**
 * Cả hai hành động dưới đây gọi hàm SQL KHÔNG nhận uid: danh tính lấy từ
 * auth.uid() bên trong database. Không có chỗ nào ở tầng này quyết định "người
 * đang sửa là ai" — thêm một lớp như vậy là tạo nguồn sự thật thứ hai, và hai
 * nguồn sẽ lệch nhau sớm muộn.
 */

export async function doiMatKhau(_prev: HoSoState, fd: FormData): Promise<HoSoState> {
  const cu = String(fd.get('cu') ?? '')
  const moi = String(fd.get('moi') ?? '')
  const lap = String(fd.get('lap') ?? '')

  // Kiểm ở đây KHÔNG thay chốt chặn trong SQL — nó vẫn kiểm lại. Chỉ để người
  // dùng không phải chờ một vòng mạng để biết hai ô gõ lệch nhau.
  const loi = loiDoiMatKhau(moi, lap)
  if (loi) return { error: loi }

  const db = await createClient()
  const { data, error } = await db.rpc('auth_doi_mat_khau_cua_toi', {
    p_cu: cu || null, p_moi: moi,
  })
  if (error) return { error: `Không đổi được mật khẩu: ${error.message}` }
  if (data !== 'ok') return { error: cauTaiKhoan(String(data)) }

  revalidatePath('/ho-so')
  return { ok: 'Đã đổi mật khẩu. Các mã đăng nhập một lần đang treo đã hết hiệu lực.' }
}

export async function doiLienLac(_prev: HoSoState, fd: FormData): Promise<HoSoState> {
  const hoTen = String(fd.get('ho_ten') ?? '')
  const email = String(fd.get('email') ?? '')
  const phone = String(fd.get('phone') ?? '')

  const loi = loiDoiLienLac(hoTen, email, phone)
  if (loi) return { error: loi }

  // Chuẩn hoá ở đây, không ở SQL: hàm SQL chỉ btrim và lower, nó không biết
  // luật số điện thoại Việt Nam và không nên biết. Chuẩn hoá hai nơi thì "0900
  // 000 111" và "+84900000111" thành hai tài khoản khác nhau.
  const { email: e, phone: p } = chuanHoaLienLac(email, phone)
  const db = await createClient()
  const { data, error } = await db.rpc('auth_doi_lien_lac_cua_toi', {
    p_ho_ten: hoTen.trim(), p_email: e, p_phone: p,
  })
  if (error) return { error: `Không lưu được: ${error.message}` }
  if (data !== 'ok') return { error: cauTaiKhoan(String(data)) }

  revalidatePath('/ho-so')
  // Nói rõ hệ quả. Người vừa đổi email không tự suy ra rằng lần đăng nhập sau
  // phải gõ địa chỉ MỚI — và nếu họ gõ địa chỉ cũ thì hệ thống sẽ im lặng trả
  // về "không có tài khoản nào" (cố ý, để không thành máy dò danh sách cư dân).
  return { ok: 'Đã lưu. Từ lần sau hãy đăng nhập bằng thông tin mới.' }
}
