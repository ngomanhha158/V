'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { LOAI_XE, type LoaiXe } from '@/lib/xe'

export type BaiXeState = { error?: string; ok?: string }

function dichLoi(code: string | undefined, msg: string): string {
  if (code === '42501') return 'Chỉ ban quản lý của dự án này mới đổi được bãi xe.'
  if (code === '23514') return msg
  if (code === '42883' || code === '42P01') {
    return 'Phần chỗ đỗ xe chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
  }
  return msg
}

const docLoai = (v: unknown): LoaiXe | null =>
  (LOAI_XE as readonly string[]).includes(String(v)) ? (String(v) as LoaiXe) : null

export async function datHanMuc(_prev: BaiXeState, formData: FormData): Promise<BaiXeState> {
  const toa = String(formData.get('toa') ?? '')
  const loai = docLoai(formData.get('loai'))
  const tong = Number(formData.get('tong_cho'))
  const moi = Number(formData.get('moi_can'))
  if (!toa || !loai) return { error: 'Chưa chọn tòa hoặc loại xe.' }
  // Chặn ở đây chứ không để Postgres ném lỗi kiểu: ô số trên form là thứ người
  // ta gõ vội, và "abc" phải nhận được câu tiếng Việt chứ không phải một lỗi
  // ép kiểu.
  if (!Number.isInteger(tong) || tong < 0) return { error: 'Số chỗ trong hầm phải là số nguyên không âm.' }
  if (!Number.isInteger(moi) || moi < 0) return { error: 'Số chỗ mỗi căn phải là số nguyên không âm.' }
  if (moi > tong) {
    return { error: `Mỗi căn ${moi} chỗ mà cả hầm chỉ có ${tong} — đặt vậy thì hạn mức không còn nghĩa gì.` }
  }

  const db = await createClient()
  const { data, error } = await db.rpc('dat_han_muc_bai_xe', {
    p_building: toa, p_loai: loai, p_tong_cho: tong, p_moi_can: moi,
  })
  if (error) return { error: dichLoi(error.code, `Không đặt được hạn mức: ${error.message}`) }

  revalidatePath('/bql/bai-xe')
  // Nói ra số xe được xét lại: nới hạn mức xong mà không thấy gì đổi thì BQL
  // tưởng nút không ăn, và bấm lại vài lần.
  return {
    ok: (data ?? 0) > 0
      ? `Đã đặt hạn mức. ${data} xe đang vượt hạn mức được đưa vào hàng chờ, giữ nguyên thứ tự đã xếp.`
      : 'Đã đặt hạn mức.',
  }
}

export async function goiNguoiTiepTheo(_prev: BaiXeState, formData: FormData): Promise<BaiXeState> {
  const toa = String(formData.get('toa') ?? '')
  const loai = docLoai(formData.get('loai'))
  if (!toa || !loai) return { error: 'Thiếu tòa hoặc loại xe.' }

  const db = await createClient()
  const { data, error } = await db.rpc('duyet_xe_tiep', { p_building: toa, p_loai: loai })
  if (error) {
    if (error.code === '23514') return { error: 'Hầm chưa còn chỗ trống. Có xe rút ra thì mới gọi được người tiếp theo.' }
    if (error.code === 'P0002') return { error: 'Hàng chờ đang trống, hoặc tòa này chưa đặt hạn mức cho loại xe đó.' }
    return { error: dichLoi(error.code, `Không gọi được: ${error.message}`) }
  }

  revalidatePath('/bql/bai-xe')
  const r = data?.[0]
  return {
    ok: r
      ? `Đã cấp chỗ cho ${r.bien_so} (căn ${r.can}). Báo cho hộ đó biết — hệ thống không tự nhắn.`
      : 'Đã gọi người tiếp theo.',
  }
}
