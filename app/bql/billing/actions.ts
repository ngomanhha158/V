'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { sheetToRows } from '@/lib/import/xlsx'
import { validateReadingRows, type ParsedReading, type RowIssue as ReadingIssue } from '@/lib/import/chi-so'
import { duAnBQL } from '@/lib/du-an'

export type BillingState = { error?: string; ok?: string }

function firstOfMonth(v: string): string | null {
  // input type=month trả "2026-08"; chuẩn hóa thành ngày đầu tháng.
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(0, 8) + '01'
  return null
}

async function projectId() {
  return (await duAnBQL())?.id ?? null
}

function humanError(e: { code?: string; message?: string }, fallback: string) {
  if (e?.code === '42501') return 'Bạn không phải BQL của dự án này.'
  if (e?.code === '22023') return 'Kỳ phải là một tháng hợp lệ.'
  return `${fallback}: ${e?.message ?? 'lỗi không rõ'}`
}

export async function generateInvoices(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const period = firstOfMonth(String(formData.get('period') ?? ''))
  if (!period) return { error: 'Chưa chọn kỳ.' }

  const db = await createClient()
  const proj = await projectId()
  if (!proj) return { error: 'Chưa có dự án nào.' }

  const { data, error } = await db.rpc('bql_generate_invoices', {
    p_project: proj, p_period: period,
  })
  if (error) return { error: humanError(error, 'Không sinh được hóa đơn') }

  revalidatePath('/bql/billing')
  // Chạy lại được: hàm chỉ đụng hóa đơn còn 'draft', đã phát hành thì không tính lại.
  return { ok: `Đã tính lại ${data} hóa đơn nháp cho kỳ ${period.slice(0, 7)}.` }
}

export async function issueInvoices(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const period = firstOfMonth(String(formData.get('period') ?? ''))
  if (!period) return { error: 'Chưa chọn kỳ.' }

  const db = await createClient()
  const proj = await projectId()
  if (!proj) return { error: 'Chưa có dự án nào.' }

  const { data, error } = await db.rpc('bql_issue_invoices', {
    p_project: proj, p_period: period,
  })
  if (error) return { error: humanError(error, 'Không phát hành được') }

  revalidatePath('/bql/billing')
  return {
    ok: data === 0
      ? 'Không có hóa đơn nháp nào để phát hành (hóa đơn 0đ được bỏ qua).'
      : `Đã phát hành ${data} hóa đơn. Từ giờ tính lại sẽ không đụng vào chúng nữa.`,
  }
}

/** Nhập chỉ số công tơ hàng loạt cho 1 kỳ. RLS chặn nếu không phải BQL. */
export async function saveReadings(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const period = firstOfMonth(String(formData.get('period') ?? ''))
  const feeTypeId = String(formData.get('fee_type_id') ?? '')
  if (!period) return { error: 'Chưa chọn kỳ.' }
  if (!feeTypeId) return { error: 'Chưa chọn loại chỉ số.' }

  const rows: { unit_id: string; fee_type_id: string; period: string; prev_index: number; curr_index: number }[] = []
  const errors: string[] = []

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('curr:')) continue
    const unitId = key.slice(5)
    const curr = String(value).trim()
    if (!curr) continue   // bỏ trống = chưa đọc được công tơ căn đó, không phải lỗi

    const prev = String(formData.get(`prev:${unitId}`) ?? '').trim()
    const code = String(formData.get(`code:${unitId}`) ?? unitId.slice(0, 8))

    // BỎ TRỐNG CHỈ SỐ CŨ LÀ LỖI, KHÔNG PHẢI SỐ 0. Trước đây chỗ này mặc định về
    // '0', mà tiền nước = curr - prev: bỏ trống một ô trên công tơ đã chạy 5 năm
    // là xuất hóa đơn cho toàn bộ số nước căn đó dùng từ ngày lắp. Hóa đơn vẫn
    // hợp lệ, vẫn có QR, vẫn gửi đi — chỉ sai tiền. Muốn số 0 thật (công tơ mới
    // lắp) thì gõ số 0 vào, một ký tự, và ý định đó nằm lại trong dữ liệu.
    if (!prev) {
      errors.push(`${code}: thiếu chỉ số cũ (công tơ mới lắp thì gõ 0)`); continue
    }

    const p = Number(prev.replace(',', '.'))
    const c = Number(curr.replace(',', '.'))

    if (!Number.isFinite(p) || !Number.isFinite(c)) {
      errors.push(`${code}: chỉ số không phải số`); continue
    }
    // Công tơ không quay ngược. Ràng buộc reading_not_backwards ở DB cũng chặn,
    // nhưng bắt ở đây thì báo được đúng căn nào thay vì ném lỗi cả lô.
    if (c < p) {
      errors.push(`${code}: chỉ số mới (${c}) nhỏ hơn chỉ số cũ (${p})`); continue
    }
    rows.push({ unit_id: unitId, fee_type_id: feeTypeId, period, prev_index: p, curr_index: c })
  }

  if (errors.length) return { error: `Chưa lưu gì cả. ${errors.length} dòng sai: ${errors.join('; ')}` }
  if (rows.length === 0) return { error: 'Chưa nhập chỉ số nào.' }

  const db = await createClient()
  // Một lệnh duy nhất, ghi đè nếu nhập lại cùng kỳ (BQL đọc nhầm rồi sửa).
  const { error } = await db
    .from('meter_readings')
    .upsert(rows, { onConflict: 'unit_id,fee_type_id,period' })

  if (error) return { error: humanError(error, 'Không lưu được chỉ số') }

  revalidatePath('/bql/billing')
  return { ok: `Đã lưu chỉ số cho ${rows.length} căn.` }
}

// ─────────────────────────────────────────────────────────────────────────────
// Import chỉ số công tơ từ Excel (N15 của kế hoạch: "form + import Excel").
//
// Vì sao cần bên cạnh cái form: form bắt gõ tay từng căn, mỗi tháng, cho cả
// tòa. 240 ô số, mỗi ô một lần gõ nhầm là một hóa đơn sai. Người đi đọc công tơ
// vốn đã ghi ra giấy hoặc ra file rồi — chỗ hay sai nhất là lúc chép lại.
// ─────────────────────────────────────────────────────────────────────────────

export type ReadingImportState =
  | { phase: 'idle' }
  | { phase: 'error'; message: string }
  | {
      phase: 'preview'
      ok: ParsedReading[]; issues: ReadingIssue[]; skippedBlank: number
      thieu: string[]; fileName: string; period: string; feeTypeId: string
    }
  | { phase: 'done'; saved: number }

/** Chỉ số cuối kỳ TRƯỚC, để điền vào khi file không có cột "chỉ số cũ". */
async function chiSoCuoiKyTruoc(
  db: Awaited<ReturnType<typeof createClient>>, period: string, feeTypeId: string,
): Promise<Record<string, number>> {
  const [nam, thang] = period.split('-').map(Number)
  const truoc = thang === 1 ? `${nam - 1}-12-01` : `${nam}-${String(thang - 1).padStart(2, '0')}-01`
  const { data } = await db
    .from('meter_readings').select('curr_index, units(code)')
    .eq('period', truoc).eq('fee_type_id', feeTypeId)
  const ra: Record<string, number> = {}
  for (const r of data ?? []) {
    const code = (r as { units?: { code?: string } }).units?.code
    if (code) ra[code] = Number(r.curr_index)
  }
  return ra
}

export async function previewReadings(
  _prev: ReadingImportState, formData: FormData,
): Promise<ReadingImportState> {
  const period = firstOfMonth(String(formData.get('period') ?? ''))
  const feeTypeId = String(formData.get('fee_type_id') ?? '')
  if (!period) return { phase: 'error', message: 'Chưa chọn kỳ.' }
  if (!feeTypeId) return { phase: 'error', message: 'Chưa chọn loại chỉ số.' }

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
  // Căn CỦA KHU ĐANG XEM, không phải mọi căn RLS cho đọc. Người quản lý hai khu
  // đọc được căn của cả hai, nên nếu chỉ dựa vào RLS thì file chỉ số của khu B
  // nhập lúc đang xem khu A sẽ qua sạch — không dòng nào bị chặn, và chỉ số ghi
  // vào đúng căn nhưng sai kỳ vọng của người nhập. Đây chính là điều mà chốt
  // "căn không thuộc khu này" phải bắt được.
  const duAn = await duAnBQL()
  if (!duAn) return { phase: 'error', message: 'Chưa chọn khu.' }
  const { data: units } = await db.from('units')
    .select('code, buildings!inner(project_id)')
    .eq('buildings.project_id', duAn.id).order('code')
  const cuoi = await chiSoCuoiKyTruoc(db, period, feeTypeId)

  const kq = validateReadingRows(rows, (units ?? []).map((u) => u.code), cuoi)
  return {
    phase: 'preview', ...kq,
    fileName: file.name, period, feeTypeId,
  }
}

export async function commitReadings(
  _prev: ReadingImportState, formData: FormData,
): Promise<ReadingImportState> {
  const period = firstOfMonth(String(formData.get('period') ?? ''))
  const feeTypeId = String(formData.get('fee_type_id') ?? '')
  if (!period || !feeTypeId) return { phase: 'error', message: 'Thiếu kỳ hoặc loại chỉ số.' }

  let ds: ParsedReading[]
  try {
    ds = JSON.parse(String(formData.get('payload') ?? '[]')) as ParsedReading[]
  } catch {
    return { phase: 'error', message: 'Dữ liệu xem trước hỏng. Tải file lên lại.' }
  }
  if (ds.length === 0) return { phase: 'error', message: 'Không có dòng nào để ghi.' }

  const db = await createClient()
  const duAn = await duAnBQL()
  if (!duAn) return { phase: 'error', message: 'Chưa chọn khu.' }
  // Đổi mã căn -> id ngay trước khi ghi, không tin id đi vòng qua trình duyệt.
  // Vẫn lọc theo khu: giữa lúc xem trước và lúc bấm ghi, người ta đổi khu được.
  const { data: units } = await db.from('units')
    .select('id, code, buildings!inner(project_id)').eq('buildings.project_id', duAn.id)
  const theoMa = new Map((units ?? []).map((u) => [u.code.toUpperCase(), u.id]))

  const rows = []
  for (const r of ds) {
    const id = theoMa.get(r.unit_code.toUpperCase())
    // Căn biến mất giữa lúc xem trước và lúc ghi. Hiếm, nhưng ghi thiếu một căn
    // mà không nói gì thì tháng đó hộ đó không có hóa đơn nước.
    if (!id) return { phase: 'error', message: `Căn "${r.unit_code}" không còn trong hệ thống. Xem lại rồi tải lên lại.` }
    rows.push({
      unit_id: id, fee_type_id: feeTypeId, period,
      prev_index: r.prev_index, curr_index: r.curr_index,
    })
  }

  const { error } = await db
    .from('meter_readings')
    .upsert(rows, { onConflict: 'unit_id,fee_type_id,period' })
  if (error) return { phase: 'error', message: humanError(error, 'Không lưu được chỉ số') }

  revalidatePath('/bql/billing')
  return { phase: 'done', saved: rows.length }
}
