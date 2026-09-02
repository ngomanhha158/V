'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { LOAI_XE, type LoaiXe } from '@/lib/xe'

export type FormState = { error?: string; ok?: string }

// Mọi hàm dưới đây đều KHÔNG tự kiểm tra "có phải chủ hộ không".
// RLS (vehicle_manager_write / pet_manager_write / membership_manager_write)
// là nơi duy nhất quyết định — thêm một lớp kiểm tra ở đây là tạo nguồn sự thật
// thứ hai, và hai nguồn sẽ lệch nhau sớm muộn.

function fail(error: unknown, fallback: string): FormState {
  const e = error as { code?: string; message?: string }
  if (e?.code === '23505') return { error: 'Bản ghi này đã tồn tại.' }
  // RLS chặn insert -> 42501; chặn update/delete -> không có dòng nào khớp.
  if (e?.code === '42501') return { error: 'Bạn không có quyền sửa căn hộ này.' }
  return { error: `${fallback}: ${e?.message ?? 'lỗi không rõ'}` }
}

/**
 * Đăng ký xe đi qua HÀM dang_ky_xe(), không insert thẳng nữa.
 *
 * Chèn thẳng thì mọi chiếc đều thành "đang dùng chỗ", kể cả khi hầm đã đầy —
 * và cái hạn mức chỉ còn là con số trang trí. Phép quyết định (hạn mức căn,
 * sức chứa hầm, vị trí hàng chờ) phải nằm đúng một chỗ, vì ba câu hỏi đó chỉ
 * trả lời đúng khi trả lời cùng lúc.
 */
export async function addVehicle(unitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const plate = String(formData.get('plate') ?? '').trim().toUpperCase()
  const loai = String(formData.get('loai') ?? '')
  const card = String(formData.get('card_no') ?? '').trim() || null
  if (!plate) return { error: 'Thiếu biển số.' }
  if (!(LOAI_XE as readonly string[]).includes(loai)) return { error: 'Chưa chọn loại xe.' }

  const db = await createClient()
  const { data, error } = await db.rpc('dang_ky_xe', {
    p_unit: unitId, p_bien_so: plate, p_loai: loai as LoaiXe, p_the: card,
  })
  if (error) {
    if (error.code === '42883') {
      return { error: 'Phần chỗ đỗ xe chưa có trên database. Chạy lại schema.sql.' }
    }
    return fail(error, 'Không đăng ký được xe')
  }

  revalidatePath(`/unit/${unitId}`)
  const kq = data?.[0]
  if (kq?.trang_thai === 'hang_cho') {
    return { ok: `Đã ghi nhận ${plate}. Hầm đang đầy nên xe vào hàng chờ, `
      + `bạn ở vị trí ${kq.vi_tri}.` }
  }
  if (kq?.trang_thai === 'qua_han_muc') {
    return { ok: `Đã ghi nhận ${plate}, nhưng căn đã dùng hết số chỗ được cấp. `
      + 'Chiếc này chưa vào hàng chờ — liên hệ ban quản lý để xin nới hạn mức.' }
  }
  return { ok: `Đã đăng ký ${plate}, xe có chỗ trong hầm.` }
}

export async function removeVehicle(unitId: string, formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const db = await createClient()
  await db.from('unit_vehicles').delete().eq('id', id)
  revalidatePath(`/unit/${unitId}`)
}

export async function addPet(unitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim()
  const species = String(formData.get('species') ?? '').trim() || null
  const until = String(formData.get('vaccinated_until') ?? '').trim() || null
  if (!name) return { error: 'Thiếu tên thú cưng.' }

  const db = await createClient()
  const { error } = await db
    .from('unit_pets')
    .insert({ unit_id: unitId, name, species, vaccinated_until: until })
  if (error) return fail(error, 'Không thêm được thú cưng')

  revalidatePath(`/unit/${unitId}`)
  return { ok: `Đã thêm ${name}.` }
}

export async function removePet(unitId: string, formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const db = await createClient()
  await db.from('unit_pets').delete().eq('id', id)
  revalidatePath(`/unit/${unitId}`)
}

/** Thu hồi tư cách thành viên, hoặc đổi ngày hết hạn. */
export async function updateMember(unitId: string, formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const action = String(formData.get('action') ?? '')
  if (!id) return

  const db = await createClient()
  if (action === 'revoke') {
    await db.from('unit_memberships').update({ status: 'revoked' }).eq('id', id)
  } else if (action === 'valid_to') {
    const validTo = String(formData.get('valid_to') ?? '').trim() || null
    await db.from('unit_memberships').update({ valid_to: validTo }).eq('id', id)
  }
  revalidatePath(`/unit/${unitId}`)
}
