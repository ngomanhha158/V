'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { validateUnitRows, type ParsedUnit, type RowIssue } from '@/lib/import/units'
import { sheetToRows } from '@/lib/import/xlsx'

export type PreviewState =
  | { phase: 'idle' }
  | { phase: 'error'; message: string }
  | { phase: 'preview'; ok: ParsedUnit[]; issues: RowIssue[]; skippedBlank: number; fileName: string }
  | { phase: 'done'; inserted: number }

/** Chỉ để ẩn/hiện giao diện. Chốt chặn thật là RLS (policy unit_staff_write). */
async function currentProject() {
  return await duAnBQL()
}

export async function previewUnits(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { phase: 'error', message: 'Chưa chọn file.' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { phase: 'error', message: 'File lớn hơn 5MB. Tách nhỏ hoặc xóa bớt sheet thừa.' }
  }

  let rows: unknown[][]
  try {
    rows = await sheetToRows(await file.arrayBuffer())
  } catch {
    return { phase: 'error', message: 'Không đọc được file. Cần đúng định dạng .xlsx (không phải .xls hay .csv).' }
  }

  const db = await createClient()
  const [{ data: buildings }, { data: units }] = await Promise.all([
    db.from('buildings').select('code'),
    db.from('units').select('code'),
  ])

  const result = validateUnitRows(
    rows,
    (buildings ?? []).map((b) => b.code),
    (units ?? []).map((u) => u.code),
  )
  return { phase: 'preview', ...result, fileName: file.name }
}

export async function commitUnits(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  const payload = String(formData.get('payload') ?? '')
  if (!payload) return { phase: 'error', message: 'Không có dữ liệu để import.' }

  let parsed: ParsedUnit[]
  try {
    parsed = JSON.parse(payload)
  } catch {
    return { phase: 'error', message: 'Dữ liệu xem trước hỏng. Chọn lại file.' }
  }
  if (parsed.length === 0) return { phase: 'error', message: 'Không có dòng hợp lệ nào.' }

  const db = await createClient()
  const project = await currentProject()
  if (!project) return { phase: 'error', message: 'Chưa có dự án nào.' }

  const { data: buildings } = await db.from('buildings').select('id, code')
  const byCode = new Map((buildings ?? []).map((b) => [b.code.toUpperCase(), b.id]))

  const rows = parsed.map((u) => ({
    building_id: byCode.get(u.building_code)!,
    code: u.code,
    floor_no: u.floor_no,
    area_m2: u.area_m2,
    kind: u.kind,
    state: u.state,
  }))
  if (rows.some((r) => !r.building_id)) {
    return { phase: 'error', message: 'Có mã tòa không còn tồn tại. Chọn lại file để kiểm tra lại.' }
  }

  // Một lệnh insert: hoặc vào hết, hoặc không dòng nào. Import nửa vời rồi bắt
  // BQL tự dò xem tới dòng nào là cách nhanh nhất để mất niềm tin.
  const { error, count } = await db.from('units').insert(rows, { count: 'exact' })
  if (error) {
    // RLS chặn ở đây nếu người dùng không phải BQL — đúng ý đồ.
    return { phase: 'error', message: `Không import được: ${error.message}` }
  }

  revalidatePath('/bql/import')
  return { phase: 'done', inserted: count ?? rows.length }
}
