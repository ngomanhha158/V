'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

export type QuyState = { error?: string; ok?: string }

const LOAI = ['so_du_dau', 'thu', 'lai', 'chi'] as const

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Chỉ trưởng BQL hoặc thành viên BQT mới ghi được sổ quỹ.'
  if (code === '23505') return 'Sổ đã có số dư đầu kỳ rồi — hai dòng số dư đầu là nhân đôi cả quỹ.'
  if (code === '42883' || code === '42P01') {
    return 'Phần quỹ bảo trì chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

/** Tiền người ta gõ: "96.000.000" hay "96 000 000" đều phải hiểu được. */
function docTien(v: unknown): number | null {
  const s = String(v ?? '').replace(/[.\s,]/g, '')
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export async function ghiQuy(_prev: QuyState, formData: FormData): Promise<QuyState> {
  const project = String(formData.get('project') ?? '')
  const loai = String(formData.get('loai') ?? '')
  const ngay = String(formData.get('ngay') ?? '')
  const dienGiai = String(formData.get('dien_giai') ?? '').trim()
  const soTien = docTien(formData.get('so_tien'))
  const nq = String(formData.get('nghi_quyet') ?? '').trim()
  const ngayNq = String(formData.get('ngay_nq') ?? '').trim()

  if (!project) return { error: 'Chưa có dự án.' }
  if (!(LOAI as readonly string[]).includes(loai)) return { error: 'Chưa chọn loại bút toán.' }
  if (!ngay) return { error: 'Chưa chọn ngày.' }
  if (!dienGiai) return { error: 'Ghi diễn giải — sổ quỹ mà chỉ có số thì năm sau không ai đọc được.' }
  if (soTien === null) {
    return { error: 'Số tiền phải là số nguyên dương. Nhập số dương kể cả với khoản chi — loại bút toán quyết định dấu.' }
  }
  // Chặn ở đây để câu nhắc nói đúng việc phải làm. Ràng buộc database vẫn còn
  // nguyên phía sau; đây chỉ là để người gõ không phải đọc lỗi 23514.
  if (loai === 'chi' && (!nq || !ngayNq)) {
    return {
      error:
        'Khoản chi phải có SỐ nghị quyết BQT và NGÀY của nghị quyết đó. ' +
        'Đây là điều kiện của luật, không phải quy trình nội bộ — thiếu thì không ghi được.',
    }
  }

  const db = await createClient()
  const { error } = await db.rpc('quy_ghi', {
    p_project: project, p_loai: loai, p_ngay: ngay, p_dien_giai: dienGiai,
    p_so_tien: soTien,
    p_nghi_quyet: nq || null, p_ngay_nq: ngayNq || null,
    p_ghi_chu: String(formData.get('ghi_chu') ?? '').trim() || null,
  })
  if (error) {
    if (error.code === '23514' && loai === 'chi') {
      return { error: `Không ghi được: quỹ không đủ cho khoản chi này, hoặc thiếu nghị quyết. ${error.message}` }
    }
    return { error: dichLoi(error.code, `Không ghi được: ${error.message}`) }
  }

  revalidatePath('/bql/quy-bao-tri')
  revalidatePath('/quy-bao-tri')
  return { ok: 'Đã ghi vào sổ quỹ. Cư dân thấy bút toán này ngay.' }
}

export async function daoQuy(_prev: QuyState, formData: FormData): Promise<QuyState> {
  const id = String(formData.get('id') ?? '')
  const lyDo = String(formData.get('ly_do') ?? '').trim()
  if (!id) return { error: 'Thiếu bút toán cần đảo.' }
  if (lyDo.length < 5) {
    return { error: 'Ghi lý do đảo — người đọc sổ về sau cần biết vì sao có hai dòng ngược nhau.' }
  }

  const db = await createClient()
  const { error } = await db.rpc('quy_dao', { p_gd: id, p_ly_do: lyDo })
  if (error) {
    if (error.code === '23505') return { error: 'Bút toán này đã đảo rồi. Đảo hai lần là cộng ngược thành thừa tiền.' }
    if (error.code === '23514') return { error: 'Không đảo được một dòng vốn đã là dòng đảo.' }
    return { error: dichLoi(error.code, `Không đảo được: ${error.message}`) }
  }

  revalidatePath('/bql/quy-bao-tri')
  revalidatePath('/quy-bao-tri')
  return { ok: 'Đã ghi bút toán đảo. Dòng gốc vẫn nằm trong sổ — sổ quỹ không xóa được dòng nào.' }
}

export async function datDoiChieu(_prev: QuyState, formData: FormData): Promise<QuyState> {
  const project = String(formData.get('project') ?? '')
  const soDu = docTien(formData.get('so_du'))
  const ngay = String(formData.get('ngay') ?? '')
  if (!project) return { error: 'Chưa có dự án.' }
  if (soDu === null) return { error: 'Số dư ngân hàng phải là số nguyên dương.' }
  if (!ngay) return { error: 'Chưa chọn ngày của sao kê.' }

  const db = await createClient()
  const { error } = await db.rpc('quy_dat_doi_chieu', {
    p_project: project,
    p_ngan_hang: String(formData.get('ngan_hang') ?? '').trim(),
    p_so_tk: String(formData.get('so_tai_khoan') ?? '').trim(),
    p_so_du: soDu, p_ngay: ngay,
  })
  if (error) return { error: dichLoi(error.code, `Không lưu được: ${error.message}`) }

  revalidatePath('/bql/quy-bao-tri')
  revalidatePath('/quy-bao-tri')
  return { ok: 'Đã cập nhật số liệu ngân hàng. Lệch hay khớp hiện ngay trên đầu sổ.' }
}
