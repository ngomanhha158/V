'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type TCState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Bạn không có quyền làm việc này.'
  if (code === '42883' || code === '42P01') {
    return 'Phần đăng ký thi công chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

function lamMoi() {
  revalidatePath('/bql/thi-cong')
  revalidatePath('/thi-cong')
}

export async function duyet(_prev: TCState, formData: FormData): Promise<TCState> {
  const id = String(formData.get('id') ?? '')
  const kyQuy = Number(String(formData.get('ky_quy') ?? '').replace(/[^\d]/g, ''))
  if (!id) return { error: 'Thiếu đăng ký.' }
  if (!Number.isFinite(kyQuy) || kyQuy < 0) return { error: 'Mức ký quỹ không hợp lệ.' }

  const gioBd = String(formData.get('gio_bat_dau') ?? '')
  const gioKt = String(formData.get('gio_ket_thuc') ?? '')
  const db = await createClient()
  const { error } = await db.rpc('duyet_thi_cong', {
    p_id: id,
    p_ky_quy: kyQuy,
    p_gio_bat_dau: /^\d\d:\d\d$/.test(gioBd) ? gioBd : null,
    p_gio_ket_thuc: /^\d\d:\d\d$/.test(gioKt) ? gioKt : null,
    p_lam_chu_nhat: formData.get('lam_chu_nhat') === 'on',
  })
  if (error) {
    if (error.code === '23514' || error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không duyệt được: ${error.message}`) }
  }
  lamMoi()
  return {
    ok: kyQuy > 0
      ? 'Đã duyệt. Giấy phép chỉ có hiệu lực khi cư dân nộp đủ ký quỹ — bảo vệ ở sảnh sẽ thấy trạng thái đó.'
      : 'Đã duyệt, không yêu cầu ký quỹ.',
  }
}

export async function tuChoi(_prev: TCState, formData: FormData): Promise<TCState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu đăng ký.' }
  if (lyDo.length < 5) return { error: 'Ghi lý do từ chối — người ta còn sửa đơn để nộp lại.' }

  const db = await createClient()
  const { error } = await db.rpc('tu_choi_thi_cong', { p_id: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23514' || error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không từ chối được: ${error.message}`) }
  }
  lamMoi()
  return { ok: 'Đã từ chối kèm lý do. Cư dân sửa đơn rồi nộp lại được.' }
}

export async function ghiKyQuy(_prev: TCState, formData: FormData): Promise<TCState> {
  const id = String(formData.get('id') ?? '')
  const soTien = Number(String(formData.get('so_tien') ?? '').replace(/[^\d]/g, ''))
  if (!id) return { error: 'Thiếu đăng ký.' }
  if (!Number.isFinite(soTien) || soTien <= 0) return { error: 'Số tiền phải lớn hơn 0.' }

  const db = await createClient()
  const { data, error } = await db.rpc('ghi_ky_quy', { p_id: id, p_so_tien: soTien })
  if (error) {
    if (error.code === '23514' || error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không ghi được: ${error.message}`) }
  }
  lamMoi()
  return { ok: `Đã ghi nhận. Tổng ký quỹ đã nhận: ${Number(data ?? 0).toLocaleString('vi-VN')}đ.` }
}

export async function tatToan(_prev: TCState, formData: FormData): Promise<TCState> {
  const id = String(formData.get('id') ?? '')
  const tru = Number(String(formData.get('tru') ?? '0').replace(/[^\d]/g, '') || '0')
  const lyDo = String(formData.get('ly_do_tru') ?? '').trim()
  if (!id) return { error: 'Thiếu đăng ký.' }
  if (tru > 0 && lyDo.length < 5) {
    return { error: 'Trừ tiền ký quỹ thì phải ghi lý do — đây là tiền của cư dân.' }
  }

  const db = await createClient()
  const { data, error } = await db.rpc('tat_toan_thi_cong', {
    p_id: id, p_tru: tru, p_ly_do_tru: lyDo || null,
  })
  if (error) {
    if (error.code === '23514' || error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không tất toán được: ${error.message}`) }
  }
  lamMoi()
  const kq = (data ?? {}) as { da_nop?: number; tru?: number; hoan?: number }
  return {
    ok:
      `Đã tất toán: nhận ${Number(kq.da_nop ?? 0).toLocaleString('vi-VN')}đ, `
      + `trừ ${Number(kq.tru ?? 0).toLocaleString('vi-VN')}đ, `
      + `hoàn lại ${Number(kq.hoan ?? 0).toLocaleString('vi-VN')}đ.`,
  }
}

export async function huy(_prev: TCState, formData: FormData): Promise<TCState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu đăng ký.' }
  if (lyDo.length < 5) return { error: 'Ghi lý do hủy.' }

  const db = await createClient()
  const { error } = await db.rpc('huy_thi_cong', { p_id: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23514') return { error: error.message }
    if (error.code === '23505') return { error: 'Đăng ký này đã khép rồi.' }
    return { error: dichLoi(error.code, `Không hủy được: ${error.message}`) }
  }
  lamMoi()
  return { ok: 'Đã hủy.' }
}
