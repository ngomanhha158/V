'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type DangKyState = { error?: string; ok?: string }

export async function dangKy(_prev: DangKyState, formData: FormData): Promise<DangKyState> {
  const unit = String(formData.get('unit') ?? '')
  const loai = String(formData.get('loai') ?? '')
  const hangMuc = String(formData.get('hang_muc') ?? '').trim()
  const tu = String(formData.get('tu') ?? '')
  const den = String(formData.get('den') ?? '')

  if (!unit) return { error: 'Chưa chọn căn hộ.' }
  if (!['chuyen_vao', 'chuyen_ra', 'thi_cong'].includes(loai)) return { error: 'Chưa chọn loại đăng ký.' }
  if (hangMuc.length < 3) return { error: 'Ghi rõ hạng mục — ban quản lý duyệt dựa vào dòng này.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tu) || !/^\d{4}-\d{2}-\d{2}$/.test(den)) {
    return { error: 'Chưa chọn khoảng ngày.' }
  }
  if (den < tu) return { error: 'Ngày kết thúc phải sau ngày bắt đầu.' }

  const soNguoi = Number(formData.get('so_nguoi'))
  const db = await createClient()
  const { error } = await db.rpc('dang_ky_thi_cong', {
    p_unit: unit,
    p_loai: loai,
    p_hang_muc: hangMuc,
    p_tu: tu,
    p_den: den,
    p_gio_bat_dau: String(formData.get('gio_bat_dau') ?? '08:00'),
    p_gio_ket_thuc: String(formData.get('gio_ket_thuc') ?? '17:00'),
    p_don_vi: String(formData.get('don_vi') ?? '').trim() || null,
    p_dien_thoai: String(formData.get('dien_thoai') ?? '').trim() || null,
    p_so_nguoi: Number.isInteger(soNguoi) && soNguoi > 0 ? soNguoi : null,
    p_ghi_chu: String(formData.get('ghi_chu') ?? '').trim() || null,
  })
  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Căn này đang có một đăng ký chờ duyệt hoặc đã duyệt. Hủy đơn đó trước — hai giấy '
          + 'phép chồng nhau là hai bộ giờ khác nhau, và bảo vệ ở sảnh không biết theo cái nào.',
      }
    }
    if (error.code === '22023' || error.code === '23514') return { error: error.message }
    if (error.code === '42501') {
      return {
        error:
          'Chỉ chủ sở hữu, người được ủy quyền hoặc người thuê mới đăng ký được. '
          + 'Đây là một cam kết có tiền ký quỹ đi kèm.',
      }
    }
    if (error.code === '42883' || error.code === '42P01') {
      return { error: 'Phần đăng ký thi công chưa có trên database. Báo ban quản lý.' }
    }
    return { error: `Không đăng ký được: ${error.message}` }
  }

  revalidatePath('/thi-cong')
  revalidatePath('/bql/thi-cong')
  return {
    ok:
      'Đã gửi đăng ký. Ban quản lý sẽ duyệt và ấn định mức ký quỹ — giấy phép chỉ có '
      + 'hiệu lực sau khi bạn nộp đủ.',
  }
}

export async function huyDon(_prev: DangKyState, formData: FormData): Promise<DangKyState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu đăng ký.' }
  if (lyDo.length < 5) return { error: 'Ghi lý do hủy.' }

  const db = await createClient()
  const { error } = await db.rpc('huy_thi_cong', { p_id: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23514') return { error: error.message }
    if (error.code === '23505') return { error: 'Đăng ký này đã khép rồi.' }
    return { error: `Không hủy được: ${error.message}` }
  }
  revalidatePath('/thi-cong')
  revalidatePath('/bql/thi-cong')
  return { ok: 'Đã hủy đăng ký.' }
}
