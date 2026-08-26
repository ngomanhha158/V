'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type BuildingState = { error?: string; ok?: string }

export async function addBuilding(_prev: BuildingState, formData: FormData): Promise<BuildingState> {
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()
  const floorsRaw = String(formData.get('floor_count') ?? '').trim()

  if (!code) return { error: 'Thiếu mã tòa.' }
  if (!name) return { error: 'Thiếu tên tòa.' }
  const floors = floorsRaw ? Number(floorsRaw) : null
  if (floorsRaw && (!Number.isInteger(floors) || floors! <= 0)) {
    return { error: `Số tầng phải là số nguyên dương, đang là "${floorsRaw}".` }
  }

  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id').limit(1).maybeSingle()
  if (!project) return { error: 'Chưa có dự án nào.' }

  // RLS (building_staff_write) mới là chốt chặn: cư dân gọi thẳng API cũng bị chặn.
  const { error } = await supabase
    .from('buildings')
    .insert({ project_id: project.id, code, name, floor_count: floors })

  if (error) {
    // unique (project_id, code) — báo cho ra nghĩa thay vì ném nguyên lỗi Postgres.
    if (error.code === '23505') return { error: `Tòa "${code}" đã tồn tại.` }
    return { error: `Không tạo được tòa: ${error.message}` }
  }

  revalidatePath('/bql')
  return { ok: `Đã tạo tòa ${code}.` }
}
