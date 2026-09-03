'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type BqlTiState = { error?: string; ok?: string }

const so = (v: unknown, min: number, max: number) => {
  const n = Number(String(v ?? '').replace(/[.\s,]/g, ''))
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

export async function luuTienIch(_prev: BqlTiState, formData: FormData): Promise<BqlTiState> {
  const project = String(formData.get('project') ?? '')
  const id = String(formData.get('id') ?? '')
  const ten = String(formData.get('ten') ?? '').trim()
  const phi = so(formData.get('phi'), 0, 1_000_000_000)
  const toiDa = so(formData.get('toi_da_tuan'), 1, 100)
  const truoc = so(formData.get('dat_truoc_ngay'), 1, 365)

  if (!ten) return { error: 'Chưa đặt tên tiện ích.' }
  if (phi === null) return { error: 'Phí phải là số nguyên không âm.' }
  if (toiDa === null) return { error: 'Hạn mức tuần phải là số nguyên từ 1 trở lên.' }
  if (truoc === null) return { error: 'Số ngày mở đặt trước phải từ 1 đến 365.' }

  const db = await createClient()
  const cot = {
    ten, phi, toi_da_tuan: toiDa, dat_truoc_ngay: truoc,
    mo_ta: String(formData.get('mo_ta') ?? '').trim() || null,
    dia_diem: String(formData.get('dia_diem') ?? '').trim() || null,
    dang_mo: formData.get('dang_mo') === 'on',
  }
  const { error } = id
    ? await db.from('tien_ich').update(cot).eq('id', id)
    : await db.from('tien_ich').insert({ ...cot, project_id: project })
  if (error) {
    if (error.code === '23505') return { error: `Đã có tiện ích tên "${ten}" rồi.` }
    if (error.code === '42501') return { error: 'Chỉ ban quản lý của dự án này mới sửa được.' }
    return { error: `Không lưu được: ${error.message}` }
  }

  revalidatePath('/bql/tien-ich')
  revalidatePath('/tien-ich')
  return { ok: id ? 'Đã lưu.' : 'Đã tạo tiện ích. Thêm khung giờ ở dưới thì cư dân mới đặt được.' }
}

export async function themSuat(_prev: BqlTiState, formData: FormData): Promise<BqlTiState> {
  const ti = String(formData.get('tien_ich') ?? '')
  const bat = String(formData.get('bat_dau') ?? '')
  const ket = String(formData.get('ket_thuc') ?? '')
  const thuTu = so(formData.get('thu_tu'), 1, 999)
  if (!ti || !bat || !ket) return { error: 'Thiếu giờ bắt đầu hoặc kết thúc.' }
  if (thuTu === null) return { error: 'Thứ tự phải là số nguyên từ 1.' }
  if (ket <= bat) return { error: 'Giờ kết thúc phải sau giờ bắt đầu.' }

  const db = await createClient()
  const { error } = await db
    .from('tien_ich_suat')
    .insert({ tien_ich_id: ti, thu_tu: thuTu, bat_dau: bat, ket_thuc: ket })
  if (error) {
    if (error.code === '23505') return { error: `Đã có khung giờ thứ tự ${thuTu} rồi.` }
    if (error.code === '42501') return { error: 'Chỉ ban quản lý của dự án này mới thêm được.' }
    return { error: `Không thêm được: ${error.message}` }
  }

  revalidatePath('/bql/tien-ich')
  revalidatePath('/tien-ich')
  return { ok: 'Đã thêm khung giờ.' }
}

export async function dongSuat(_prev: BqlTiState, formData: FormData): Promise<BqlTiState> {
  const suat = String(formData.get('suat') ?? '')
  const ngay = String(formData.get('ngay') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!suat || !ngay) return { error: 'Thiếu suất hoặc ngày.' }
  if (lyDo.length < 3) {
    return { error: 'Ghi lý do đóng — cư dân nhìn thấy đúng dòng chữ đó trên lịch.' }
  }

  const db = await createClient()
  const { error } = await db.rpc('dong_suat', { p_suat: suat, p_ngay: ngay, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Suất này đã có người đặt hoặc đã đóng rồi. Muốn đóng thì báo căn đang giữ chỗ trước — ' +
          'hệ thống không tự hủy lượt đặt của cư dân.',
      }
    }
    if (error.code === '42501') return { error: 'Chỉ ban quản lý của dự án này mới đóng được suất.' }
    return { error: `Không đóng được: ${error.message}` }
  }

  revalidatePath('/bql/tien-ich')
  revalidatePath('/tien-ich')
  return { ok: 'Đã đóng suất. Cư dân thấy lý do bạn vừa ghi.' }
}
