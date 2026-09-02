'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

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

export async function addVehicle(unitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const plate = String(formData.get('plate') ?? '').trim().toUpperCase()
  const type = String(formData.get('vehicle_type') ?? '').trim() || null
  const card = String(formData.get('card_no') ?? '').trim() || null
  if (!plate) return { error: 'Thiếu biển số.' }

  const db = await createClient()
  const { error } = await db
    .from('unit_vehicles')
    .insert({ unit_id: unitId, plate, vehicle_type: type, card_no: card })
  if (error) return fail(error, 'Không thêm được xe')

  revalidatePath(`/unit/${unitId}`)
  return { ok: `Đã thêm xe ${plate}.` }
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
