'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type SoTayState = { error?: string; ok?: string }

const rong = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : ''
  return s === '' ? null : s
}

export async function luuMuc(_prev: SoTayState, form: FormData): Promise<SoTayState> {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id').limit(1).maybeSingle()
  if (!project) return { error: 'Chưa có dự án nào.' }

  const section = rong(form.get('section'))
  const title = rong(form.get('title'))
  const body = rong(form.get('body'))
  if (!section || !title || !body) {
    return { error: 'Mục, tiêu đề và nội dung đều bắt buộc.' }
  }

  const id = rong(form.get('id'))
  if (id) {
    // Sửa mục cũ: tăng version. Nội quy là thứ cư dân viện dẫn khi tranh cãi,
    // nên phải biết mình đang đọc bản thứ mấy.
    const { data: cu } = await db
      .from('documents').select('version').eq('id', id).maybeSingle()
    const { error } = await db
      .from('documents')
      .update({ section, title, body, version: (cu?.version ?? 1) + 1 })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await db
      .from('documents')
      .insert({ project_id: project.id, section, title, body })
    if (error) return { error: error.message }
  }

  revalidatePath('/bql/so-tay')
  revalidatePath('/so-tay')
  return { ok: id ? 'Đã cập nhật.' : 'Đã thêm mục mới.' }
}

export async function xoaMuc(id: string) {
  const db = await createClient()
  // announcements.document_id là ON DELETE SET NULL, nên xóa nội quy không làm
  // hỏng thông báo cũ — nó chỉ mất nút trích dẫn.
  const { error } = await db.from('documents').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/bql/so-tay')
  revalidatePath('/so-tay')
}
