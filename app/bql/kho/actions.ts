'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type KhoState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Bạn không có quyền làm việc này.'
  if (code === '42883' || code === '42P01') {
    return 'Phần kho vật tư chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

const lamMoi = () => revalidatePath('/bql/kho')

/** Đọc các dòng `dong_<i>_vt` / `dong_<i>_sl` / `dong_<i>_gia` của form. */
function docDong(formData: FormData, coGia: boolean) {
  const ra: { vat_tu: string; so_luong: number; don_gia?: number }[] = []
  for (const [k, v] of formData.entries()) {
    const m = /^dong_(\d+)_vt$/.exec(k)
    if (!m || !String(v)) continue
    const i = m[1]
    const sl = Number(String(formData.get(`dong_${i}_sl`) ?? '').replace(',', '.'))
    if (!Number.isFinite(sl) || sl <= 0) continue
    const d: { vat_tu: string; so_luong: number; don_gia?: number } = {
      vat_tu: String(v), so_luong: sl,
    }
    if (coGia) {
      d.don_gia = Number(String(formData.get(`dong_${i}_gia`) ?? '').replace(/[^\d]/g, ''))
      if (!Number.isFinite(d.don_gia) || d.don_gia < 0) continue
    }
    ra.push(d)
  }
  return ra
}

export async function nhapKho(_prev: KhoState, formData: FormData): Promise<KhoState> {
  const project = String(formData.get('project') ?? '')
  const dong = docDong(formData, true)
  if (!project) return { error: 'Chưa có dự án.' }
  if (dong.length === 0) {
    return { error: 'Chưa có dòng nào hợp lệ. Mỗi dòng cần vật tư, số lượng và đơn giá.' }
  }

  const db = await createClient()
  const { error } = await db.rpc('nhap_kho', {
    p_project: project,
    p_ly_do: String(formData.get('ly_do') ?? '').trim() || null,
    p_dong: dong,
  })
  if (error) {
    if (error.code === '22023' || error.code === '23514') return { error: error.message }
    return { error: dichLoi(error.code, `Không nhập được: ${error.message}`) }
  }
  lamMoi()
  return {
    ok:
      'Đã nhập kho. Giá kho của các vật tư vừa nhập đã tính lại theo bình quân gia quyền — '
      + 'lần xuất tới sẽ dùng giá mới đó.',
  }
}

export async function xuatKho(_prev: KhoState, formData: FormData): Promise<KhoState> {
  const project = String(formData.get('project') ?? '')
  const ticket = String(formData.get('ticket') ?? '').trim() || null
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  const dong = docDong(formData, false)
  if (!project) return { error: 'Chưa có dự án.' }
  if (dong.length === 0) return { error: 'Chưa có dòng nào hợp lệ. Mỗi dòng cần vật tư và số lượng.' }
  if (!ticket && !lyDo) {
    return {
      error:
        'Chọn yêu cầu, hoặc ghi lý do. Một lần xuất không gắn với gì cả là đúng dòng mà '
        + 'cuối tháng không ai giải trình được.',
    }
  }

  const db = await createClient()
  const { error } = await db.rpc('xuat_kho', {
    p_project: project, p_ticket: ticket, p_ly_do: lyDo || null, p_dong: dong,
  })
  if (error) {
    // 23514 ở đây là câu "X chỉ còn N trong kho" — nó đã nói ra con số người
    // đứng ở kho cần, dịch lại là làm mất đúng con số đó.
    if (error.code === '23514' || error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không xuất được: ${error.message}`) }
  }
  lamMoi()
  return { ok: 'Đã xuất kho. Phiếu này gắn vào yêu cầu nên cuối tháng tra ngược được.' }
}

export async function kiemKe(_prev: KhoState, formData: FormData): Promise<KhoState> {
  const project = String(formData.get('project') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!project) return { error: 'Chưa có dự án.' }
  if (lyDo.length < 5) return { error: 'Ghi lý do kiểm kê — đây là bước sửa lại sổ sách.' }

  const dong: { vat_tu: string; thuc_te: number }[] = []
  for (const [k, v] of formData.entries()) {
    const m = /^that_(.+)$/.exec(k)
    if (!m) continue
    const n = Number(String(v).replace(',', '.'))
    // Ô để trống nghĩa là "không đếm vật tư này", khác hẳn với "đếm được 0".
    if (String(v).trim() === '' || !Number.isFinite(n) || n < 0) continue
    dong.push({ vat_tu: m[1], thuc_te: n })
  }
  if (dong.length === 0) return { error: 'Chưa nhập số đếm thực tế của vật tư nào.' }

  const db = await createClient()
  const { data, error } = await db.rpc('kiem_ke_kho', {
    p_project: project, p_ly_do: lyDo, p_dong: dong,
  })
  if (error) {
    if (error.code === '22023') return { error: error.message }
    return { error: dichLoi(error.code, `Không kiểm kê được: ${error.message}`) }
  }
  lamMoi()
  const kq = (data ?? {}) as { so_vat_tu_lech?: number; gia_tri_lech?: number }
  const n = Number(kq.so_vat_tu_lech ?? 0)
  if (n === 0) {
    return { ok: `Đã kiểm kê ${dong.length} vật tư. Sổ khớp thực tế, không phải điều chỉnh gì.` }
  }
  return {
    ok:
      `Đã kiểm kê ${dong.length} vật tư, ${n} vật tư lệch so với sổ `
      + `(${Number(kq.gia_tri_lech ?? 0).toLocaleString('vi-VN')}đ). Chênh lệch đã ghi thành `
      + 'dòng trong sổ kèm lý do — không có cách nào sửa tồn mà không để lại vết.',
  }
}
