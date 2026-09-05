'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
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

    const prev = String(formData.get(`prev:${unitId}`) ?? '0').trim() || '0'
    const code = String(formData.get(`code:${unitId}`) ?? unitId.slice(0, 8))
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
