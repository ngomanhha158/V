'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type KhachState = { error?: string; ok?: string; id?: string }

/** Ô datetime-local trả về "2026-09-03T14:00" — giờ ĐỊA PHƯƠNG của máy người
 *  dùng, không có múi giờ. Máy cư dân ở VN nên đó là giờ VN; ghép '+07:00' vào
 *  để server (chạy UTC) không hiểu thành 14:00 UTC, tức 21:00 giờ VN. */
function gioVN(v: unknown): string | null {
  const s = String(v ?? '')
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00+07:00` : null
}

export async function moiKhach(_prev: KhachState, formData: FormData): Promise<KhachState> {
  const unit = String(formData.get('unit') ?? '')
  const hoTen = String(formData.get('ho_ten') ?? '').trim()
  const tu = gioVN(formData.get('tu'))
  const den = gioVN(formData.get('den'))

  if (!unit) return { error: 'Chưa chọn căn hộ.' }
  if (!hoTen) return { error: 'Ghi tên khách — bảo vệ đối chiếu bằng tên khi khách tới.' }
  if (!tu || !den) return { error: 'Chưa chọn khung giờ.' }
  if (new Date(den) <= new Date(tu)) return { error: 'Giờ kết thúc phải sau giờ bắt đầu.' }
  const ngay = (new Date(den).getTime() - new Date(tu).getTime()) / 86_400_000
  if (ngay > 7) {
    return {
      error:
        'Khung giờ tối đa 7 ngày. Mã sống lâu hơn thế thì nó không còn là giấy mời khách nữa, ' +
        'nó là chìa khóa — mời lại một lượt mới khi cần.',
    }
  }

  const db = await createClient()
  const { data, error } = await db.rpc('moi_khach', {
    p_unit: unit, p_ho_ten: hoTen, p_tu: tu, p_den: den,
    p_dien_thoai: String(formData.get('dien_thoai') ?? '').trim() || null,
    p_ly_do: String(formData.get('ly_do') ?? '').trim() || null,
  })
  if (error) {
    if (error.code === '42501') return { error: 'Chỉ người trong căn mới mời được khách vào căn đó.' }
    if (error.code === '42883' || error.code === '42P01') {
      return { error: 'Phần khách thăm chưa có trên database. Báo ban quản lý.' }
    }
    return { error: `Không mời được: ${error.message}` }
  }

  revalidatePath('/khach')
  return { ok: 'Đã tạo mã. Mở ra rồi gửi cho khách.', id: data?.[0]?.id }
}

export async function thuHoi(_prev: KhachState, formData: FormData): Promise<KhachState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Thiếu lượt khách.' }

  const db = await createClient()
  const { error } = await db.rpc('thu_hoi_khach', { p_id: id })
  if (error) {
    if (error.code === '23514') {
      return {
        error:
          'Khách đã vào tòa rồi — thu hồi mã không đưa được họ ra. Báo bảo vệ nếu cần.',
      }
    }
    if (error.code === '42501') return { error: 'Chỉ người trong căn mới thu hồi được.' }
    return { error: `Không thu hồi được: ${error.message}` }
  }

  revalidatePath('/khach')
  return { ok: 'Đã thu hồi. Bảo vệ quét mã đó sẽ thấy báo không cho vào.' }
}
