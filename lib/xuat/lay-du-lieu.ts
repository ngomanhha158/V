import type { createClient } from '@/lib/db/server'
import { mocKy } from './bao-cao.ts'

type Db = Awaited<ReturnType<typeof createClient>>

export type KetQua =
  | { dong: Record<string, unknown>[] }
  | { loi: string }

/** Một dòng embed của PostgREST có thể là object hoặc mảng tùy quan hệ. */
const mot = <T,>(v: T | T[] | null): T | null =>
  (Array.isArray(v) ? (v[0] ?? null) : v)

/**
 * Thiếu `grant select` thì Postgres trả 42501, và người dùng chỉ thấy "không
 * xuất được" — vô nghĩa. Dịch ra thành câu nói đúng việc phải làm, vì đây là
 * lỗi cấu hình database chứ không phải lỗi thao tác.
 */
function dichLoi(bang: string, code: string | undefined, msg: string): string {
  if (code === '42501') {
    return `Chưa mở quyền đọc bảng ${bang}. Chạy lại auth_hooks.sql trên database `
      + '(phần grant select) rồi xuất lại.'
  }
  return `Không đọc được ${bang}: ${msg}`
}

export async function layDong(
  db: Db, loai: string, project: string, ky: string | null,
): Promise<KetQua> {
  if (loai === 'cong-no') {
    const { data, error } = await db.rpc('bql_debt_report', { p_project: project })
    if (error) return { loi: dichLoi('công nợ', error.code, error.message) }
    return { dong: (data ?? []) as unknown as Record<string, unknown>[] }
  }

  if (!ky) return { loi: 'Báo cáo này cần chọn kỳ.' }
  const { tu, den } = mocKy(ky)

  if (loai === 'so-quy') {
    // units!inner: lọc theo dự án nằm ở bảng lồng, không có !inner thì PostgREST
    // chỉ lọc phần embed và vẫn trả về mọi dòng payments của mọi khu.
    const { data, error } = await db
      .from('payments')
      .select(`paid_at, amount, method, bank_ref, matched_by,
               units!inner(code, buildings!inner(code, project_id)), invoices(period)`)
      .eq('units.buildings.project_id', project)
      .gte('paid_at', tu).lt('paid_at', den)
      .order('paid_at')
    if (error) return { loi: dichLoi('sổ quỹ (payments)', error.code, error.message) }
    return {
      dong: (data ?? []).map((p) => {
        const u = mot(p.units)
        return {
          paid_at: p.paid_at,
          building_code: mot(u?.buildings)?.code ?? null,
          unit_code: u?.code ?? null,
          amount: p.amount,
          method: p.method,
          bank_ref: p.bank_ref,
          matched_by: p.matched_by,
          ky_hoa_don: mot(p.invoices)?.period ?? null,
        }
      }),
    }
  }

  if (loai === 'hoa-don') {
    const { data, error } = await db
      .from('invoices')
      .select(`period, status, due_date, total_amount, paid_amount,
               units!inner(code, buildings!inner(code)),
               invoice_lines(description, quantity, unit_price, amount)`)
      .eq('project_id', project).eq('period', `${ky}-01`)
      .order('due_date')
    if (error) return { loi: dichLoi('hóa đơn', error.code, error.message) }

    // Một dòng bảng = một dòng phí. Hóa đơn chưa có dòng phí nào vẫn phải hiện
    // ra: hóa đơn rỗng là chuyện cần biết, không phải chuyện để giấu đi.
    const dong: Record<string, unknown>[] = []
    for (const i of data ?? []) {
      const u = mot(i.units)
      const chung = {
        building_code: mot(u?.buildings)?.code ?? null,
        unit_code: u?.code ?? null,
        trang_thai: i.status,
        due_date: i.due_date,
        total_amount: i.total_amount,
        paid_amount: i.paid_amount,
      }
      const lines = i.invoice_lines ?? []
      if (lines.length === 0) {
        dong.push({ ...chung, description: '(hóa đơn không có dòng phí nào)' })
        continue
      }
      for (const l of lines) {
        dong.push({
          ...chung,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          amount: l.amount,
        })
      }
    }
    return { dong }
  }

  if (loai === 'doi-soat') {
    const { data, error } = await db
      .from('bank_transactions')
      .select(`paid_at, provider, provider_ref, amount, content, trang_thai,
               cach_khop, con_du, units(code)`)
      .eq('project_id', project)
      .gte('paid_at', tu).lt('paid_at', den)
      .order('paid_at')
    if (error) return { loi: dichLoi('sổ tiền về', error.code, error.message) }
    return {
      dong: (data ?? []).map((t) => ({
        paid_at: t.paid_at,
        provider: t.provider,
        provider_ref: t.provider_ref,
        amount: t.amount,
        content: t.content,
        trang_thai: t.trang_thai,
        cach_khop: t.cach_khop,
        unit_code: mot(t.units)?.code ?? null,
        con_du: t.con_du,
      })),
    }
  }

  return { loi: `Không có báo cáo "${loai}".` }
}
