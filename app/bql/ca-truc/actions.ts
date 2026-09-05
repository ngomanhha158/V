'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type CaState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Bạn không có quyền làm việc này.'
  if (code === '42883' || code === '42P01') {
    return 'Phần ca trực chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

function lamMoi() {
  revalidatePath('/bql/ca-truc')
  revalidatePath('/bql/dashboard')
}

export async function vaoCa(_prev: CaState, formData: FormData): Promise<CaState> {
  const ca = String(formData.get('ca') ?? '')
  if (!ca) return { error: 'Chưa chọn ca.' }

  const db = await createClient()
  const { error } = await db.rpc('vao_ca', { p_ca: ca, p_ngay: null })
  if (error) {
    if (error.code === '23505') {
      return { error: 'Bạn đang trong một ca chưa kết. Bàn giao hoặc kết ca đó trước đã.' }
    }
    if (error.code === '23514') return { error: error.message }
    return { error: dichLoi(error.code, `Không vào ca được: ${error.message}`) }
  }
  lamMoi()
  return { ok: 'Đã vào ca.' }
}

export async function banGiao(_prev: CaState, formData: FormData): Promise<CaState> {
  const ra = String(formData.get('phien_ra') ?? '')
  const vao = String(formData.get('phien_vao') ?? '')
  const tinhHinh = String(formData.get('tinh_hinh') ?? '').trim()
  const viec = formData.getAll('viec').map(String).filter(Boolean)

  if (!ra) return { error: 'Bạn chưa vào ca nào.' }
  if (!vao) return { error: 'Chưa chọn người nhận ca.' }
  if (tinhHinh.length < 5) {
    return {
      error:
        'Ghi tình hình ca — kể cả khi không có gì bất thường. Im lặng và bình yên '
        + 'trông giống hệt nhau trong sổ.',
    }
  }

  const db = await createClient()
  const { error } = await db.rpc('ban_giao_ca', {
    p_phien_ra: ra, p_phien_vao: vao, p_tinh_hinh: tinhHinh, p_viec: viec,
  })
  if (error) {
    if (error.code === '23514') return { error: error.message }
    if (error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không bàn giao được: ${error.message}`) }
  }
  lamMoi()
  return {
    ok:
      'Đã bàn giao và kết ca của bạn. Biên bản chỉ có hiệu lực khi người nhận ca '
      + 'ký nhận — nó nằm trong danh sách chờ ký cho tới lúc đó.',
  }
}

export async function kyNhan(_prev: CaState, formData: FormData): Promise<CaState> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Thiếu biên bản.' }

  const db = await createClient()
  const { error } = await db.rpc('ky_nhan_ca', { p_id: id })
  if (error) {
    if (error.code === '23505') return { error: 'Biên bản này đã ký nhận rồi.' }
    if (error.code === '42501') {
      return { error: 'Chỉ người NHẬN ca mới ký nhận được. Người giao ca ký thì chữ ký đó không chứng minh gì.' }
    }
    return { error: dichLoi(error.code, `Không ký nhận được: ${error.message}`) }
  }
  lamMoi()
  return { ok: 'Đã ký nhận. Từ giờ việc của ca trước là việc của bạn.' }
}

export async function ketCa(_prev: CaState, formData: FormData): Promise<CaState> {
  const phien = String(formData.get('phien') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!phien) return { error: 'Thiếu phiên trực.' }
  if (lyDo.length < 5) {
    return { error: 'Ghi lý do kết ca mà không bàn giao — dòng này ở lại trong sổ.' }
  }

  const db = await createClient()
  const { error } = await db.rpc('ket_ca_khong_ban_giao', { p_phien: phien, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23505') return { error: 'Ca này đã kết rồi.' }
    return { error: dichLoi(error.code, `Không kết ca được: ${error.message}`) }
  }
  lamMoi()
  return { ok: 'Đã kết ca kèm lý do. Dòng này nằm lại trong sổ để ban quản lý biết đã có khoảng trống.' }
}
