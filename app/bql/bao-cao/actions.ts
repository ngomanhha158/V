'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type BCState = { error?: string; ok?: string }

const lamMoi = () => { revalidatePath('/bql/bao-cao'); revalidatePath('/bao-cao') }

export async function lapBaoCao(_prev: BCState, formData: FormData): Promise<BCState> {
  const project = String(formData.get('project') ?? '')
  const [nam, quy] = String(formData.get('ky') ?? '').split('-').map(Number)
  if (!project) return { error: 'Chưa có dự án.' }
  if (!Number.isInteger(nam) || !Number.isInteger(quy)) return { error: 'Chưa chọn quý.' }

  const db = await createClient()
  const { error } = await db.rpc('lap_bao_cao_quy', { p_project: project, p_nam: nam, p_quy: quy })
  if (error) {
    if (error.code === '23505') {
      return {
        error:
          'Quý này đã có báo cáo rồi. Hai bản cho cùng một quý là hai bộ số cùng tự xưng '
          + 'là sự thật của quý đó — hủy bản cũ kèm lý do rồi mới lập lại được.',
      }
    }
    if (error.code === '22023') return { error: error.message }
    if (error.code === '42501') {
      return { error: 'Chỉ trưởng ban quản lý hoặc thành viên ban quản trị mới lập được báo cáo.' }
    }
    if (error.code === '42883' || error.code === '42P01') {
      return { error: 'Phần báo cáo quý chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.' }
    }
    return { error: `Không lập được: ${error.message}` }
  }
  lamMoi()
  return {
    ok:
      'Đã lập. Các con số vừa được đóng băng — mở lại báo cáo này sau nhiều năm vẫn ra '
      + 'đúng bộ số hôm nay, kể cả khi dữ liệu gốc đã đổi.',
  }
}

export async function huyBaoCao(_prev: BCState, formData: FormData): Promise<BCState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu báo cáo.' }
  if (lyDo.length < 5) return { error: 'Ghi lý do hủy — bản cũ vẫn nằm lại trong sổ kèm dòng này.' }

  const db = await createClient()
  const { error } = await db.rpc('huy_bao_cao_quy', { p_id: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23505') return { error: 'Báo cáo này đã hủy rồi.' }
    if (error.code === '22023') return { error: error.message }
    return { error: `Không hủy được: ${error.message}` }
  }
  lamMoi()
  return { ok: 'Đã hủy. Bản cũ vẫn nằm lại kèm lý do — biên bản họp cũ còn trỏ vào nó.' }
}
