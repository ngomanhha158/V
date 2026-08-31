'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type BangTinState = { error?: string; ok?: string }

/** '' -> null. Form gửi chuỗi rỗng cho ô không chọn, mà cột thì cần NULL. */
const rong = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

export async function dangThongBao(
  _prev: BangTinState, form: FormData,
): Promise<BangTinState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Chưa đăng nhập.' }

  const { data: project } = await supabase.from('projects').select('id').limit(1).maybeSingle()
  if (!project) return { error: 'Chưa có dự án nào.' }

  const title = rong(form.get('title'))
  const body = rong(form.get('body'))
  if (!title || !body) return { error: 'Tiêu đề và nội dung không được để trống.' }

  const floorRaw = rong(form.get('floor_no'))
  const floor = floorRaw === null ? null : Number(floorRaw)
  if (floor !== null && !Number.isInteger(floor)) {
    return { error: 'Tầng phải là số nguyên.' }
  }

  // Nhắm theo tầng mà không chọn tòa thì "tầng 12" nghĩa là tầng 12 của MỌI
  // tòa — gần như luôn là nhầm. Chặn ở đây thay vì để BQL phát hiện sau khi
  // cả khu đã nhận tin.
  const building = rong(form.get('building_id'))
  if (floor !== null && !building) {
    return { error: 'Chọn tầng thì phải chọn tòa, nếu không tin sẽ tới tầng đó ở mọi tòa.' }
  }

  const unit = rong(form.get('unit_id'))
  const phatHanhNgay = form.get('phat_hanh') === '1'

  // RLS (announcement_staff_write) là chốt chặn: không phải BQL thì insert bị từ chối.
  const { error } = await supabase.from('announcements').insert({
    project_id: project.id,
    building_id: unit ? null : building,   // nhắm 1 căn thì tòa/tầng thừa
    floor_no: unit ? null : floor,
    unit_id: unit,
    title,
    body,
    document_id: rong(form.get('document_id')),
    is_urgent: form.get('is_urgent') === '1',
    published_at: phatHanhNgay ? new Date().toISOString() : null,
    author_id: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/bql/bang-tin')
  revalidatePath('/bang-tin')
  return { ok: phatHanhNgay ? 'Đã phát hành thông báo.' : 'Đã lưu bản nháp.' }
}

export async function phatHanh(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('announcements')
    .update({ published_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/bql/bang-tin')
  revalidatePath('/bang-tin')
}

export async function xoaThongBao(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/bql/bang-tin')
  revalidatePath('/bang-tin')
}
